import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import {
  getUnitPath,
  getUnitAncestors,
  getUnitDescendants,
  isAncestorUnit,
} from "../../../utils/path.js";
import { UserRole } from "@prisma/client";
import { calculateKPIProgressStatus } from "../../../utils/okr.js";
import {
    notifyKPIAssignmentEvent,
} from "../../../utils/notificationHelper.js";
import { getCloudinaryImageUrl } from "../../../utils/cloudinary.js";

const toDateOnlyUtc = (date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const isDescendantOrEqual = (candidate, ancestor) => {
  if (!candidate || !ancestor) return false;
  return candidate === ancestor || candidate.startsWith(`${ancestor}.`);
};

const isAncestorOrEqual = (candidate, descendant) => {
  if (!candidate || !descendant) return false;
  return descendant === candidate || descendant.startsWith(`${candidate}.`);
};

const calculateProgressPercentage = (
  currentValue,
  targetValue,
  startValue,
  evaluationMethod,
) => {
  // Explicitly convert to numbers to handle Decimal/string types from Prisma
  const actual = parseFloat(currentValue);
  const target = parseFloat(targetValue);
  const start = parseFloat(startValue);

  // Validate inputs
  if (isNaN(actual) || isNaN(target) || isNaN(start)) {
    console.log("[DEBUG] Invalid inputs:", { currentValue, targetValue, startValue, evaluationMethod });
    return 0;
  }

  // Edge case: start equals target
  if (start === target) {
    return actual === target ? 100 : 0;
  }

  let progress = 0;

  switch (evaluationMethod) {
    case "MAXIMIZE":
      // Higher is better. Formula: (actual - start) / (target - start) * 100
      // Can exceed 100% if actual > target, can be negative if actual < start
      progress = ((actual - start) / (target - start)) * 100;
      break;

    case "MINIMIZE":
      // Lower is better. Formula: (start - actual) / (start - target) * 100
      // Can exceed 100% if actual < target, can be negative if actual > start
      progress = ((start - actual) / (start - target)) * 100;
      break;

    case "TARGET":
      // Closer to target is better. Formula: (1 - |actual - target| / |start - target|) * 100
      // Can exceed 100% if closer than start, can be negative if further than start
      const deviation = Math.abs(actual - target);
      const maxDeviation = Math.abs(start - target);
      if (maxDeviation === 0) {
        return actual === target ? 100 : 0;
      }
      progress = (1 - deviation / maxDeviation) * 100;
      break;

    default:
      // Fallback to MAXIMIZE behavior for unknown methods
      progress = ((actual - start) / (target - start)) * 100;
  }

  // No bounds for KPI - can exceed 100% or go below 0%
  // Round to 2 decimal places
  return Math.round(progress * 100) / 100;
};

/**
 * Calculate KPI progress status based on fixed thresholds.
 * KPI uses absolute progress values unlike OKR which uses time-based calculation.
 *
 * @param {number} progress - Progress percentage
 * @returns {string} ProgressStatus enum value
 *
 * Logic:
 * - NOT_STARTED: 0%
 * - COMPLETED: >= 100%
 * - ON_TRACK: >= 80%
 * - AT_RISK: >= 50%
 * - CRITICAL: < 50%
 */
const calculateKPIStatus = (progress) => {
  return calculateKPIProgressStatus(progress);
};

// Calculate permissions for a KPI assignment based on user
const calculateAssignmentPermissions = async (user, assignment) => {
  const permissions = {
    view: false,
    edit: false,
    delete: false,
  };

  if (!assignment || !user) return permissions;

  // ADMIN_COMPANY has all permissions
  if (user.role === UserRole.ADMIN_COMPANY) {
    permissions.view = true;
    permissions.edit = true;
    permissions.delete = true;
    return permissions;
  }

  // Check view permission using existing logic
  const canView = await canViewAssignment(user, assignment);
  permissions.view = canView;

  if (!canView) return permissions;

  // Edit/Delete permission: from ancestor unit (not same unit) OR is manager
  let canEditDelete = false;

  // Check if user is from ancestor unit (not same unit)
  if (assignment.unit_id && user.unit_id) {
    if (
      user.unit_id !== assignment.unit_id &&
      (await isAncestorUnit(user.unit_id, assignment.unit_id))
    ) {
      canEditDelete = true;
    }
  }

  // Check if user is manager of the unit
  if (!canEditDelete && assignment.unit_id) {
    const unit = await prisma.units.findUnique({
      where: { id: assignment.unit_id },
      select: { manager_id: true },
    });
    if (unit?.manager_id === user.id) {
      canEditDelete = true;
    }
  }

  // For user assignment, check if user is from ancestor of owner's unit
  if (!canEditDelete && assignment.owner_id) {
    const owner = await prisma.users.findUnique({
      where: { id: assignment.owner_id },
      select: { unit_id: true },
    });
    if (owner?.unit_id && user.unit_id) {
      if (
        user.unit_id !== owner.unit_id &&
        (await isAncestorUnit(user.unit_id, owner.unit_id))
      ) {
        canEditDelete = true;
      }
      // Check if user is manager of owner's unit
      const ownerUnit = await prisma.units.findUnique({
        where: { id: owner.unit_id },
        select: { manager_id: true },
      });
      if (ownerUnit?.manager_id === user.id) {
        canEditDelete = true;
      }
    }
  }

  permissions.edit = canEditDelete;
  permissions.delete = canEditDelete;

  return permissions;
};

const assignmentSelect = {
  id: true,
  kpi_dictionary_id: true,
  target_value: true,
  start_value: true,
  current_value: true,
  progress_percentage: true,
  visibility: true,
  owner_id: true,
  unit_id: true,
  parent_assignment_id: true,
  cycle_id: true,
  due_date: true,
};

const formatAssignment = async (assignment, user = null) => {
  const [dictionary, owner, unit, parentAssignment, latestRecord, cycle] =
    await Promise.all([
      prisma.kPIDictionaries.findUnique({
        where: { id: assignment.kpi_dictionary_id },
        select: { id: true, name: true, unit: true, evaluation_method: true },
      }),
      assignment.owner_id
        ? prisma.users.findUnique({
            where: { id: assignment.owner_id },
            select: { id: true, full_name: true, email: true, avatar_url: true },
          })
        : null,
      assignment.unit_id
        ? prisma.units.findUnique({
            where: { id: assignment.unit_id },
            select: { id: true, name: true },
          })
        : null,
      assignment.parent_assignment_id
        ? prisma.kPIAssignments.findUnique({
            where: { id: assignment.parent_assignment_id },
            select: { id: true, target_value: true },
          })
        : null,
      prisma.kPIRecords.findFirst({
        where: { kpi_assignment_id: assignment.id },
        orderBy: { created_at: "desc" },
        select: { status: true, trend: true, created_at: true },
      }),
      assignment.cycle_id
        ? prisma.cycles.findUnique({
            where: { id: assignment.cycle_id },
            select: { id: true, name: true, start_date: true, end_date: true },
          })
        : null,
    ]);

  // Calculate permissions if user is provided
  const permissions = user
    ? await calculateAssignmentPermissions(user, assignment)
    : null;

  const result = {
    id: assignment.id,
    kpi_dictionary: dictionary,
    target_value: Math.round((assignment.target_value || 0) * 100) / 100,
    start_value: Math.round((assignment.start_value || 0) * 100) / 100,
    current_value: Math.round((assignment.current_value || 0) * 100) / 100,
    progress_percentage: Math.round((assignment.progress_percentage || 0) * 100) / 100,
    progress_status: calculateKPIStatus(assignment.progress_percentage),
    status: latestRecord?.status || null,
    visibility: assignment.visibility,
    due_date: assignment.due_date ?? null,
    owner: owner ? {
      ...owner,
      avatar_url: owner.avatar_url
        ? getCloudinaryImageUrl(owner.avatar_url, 50, 50, "fill")
        : null,
    } : null,
    unit: unit,
    cycle: cycle,
    parent_assignment: parentAssignment,
    latest_record: latestRecord,
  };

  if (permissions) {
    result.permission = permissions;
  }

  return result;
};

const canViewAssignment = async (user, assignment) => {
  if (user.role === UserRole.ADMIN_COMPANY) return true;

  if (assignment.visibility === "PUBLIC") return true;

  const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;
  const assignmentPath = assignment.access_path
    ? assignment.access_path
    : assignment.unit_id
      ? await getUnitPath(assignment.unit_id)
      : null;

  if (assignment.visibility === "INTERNAL") {
    if (!assignmentPath || !userPath) return false;
    return (
      isAncestorOrEqual(assignmentPath, userPath) ||
      isDescendantOrEqual(assignmentPath, userPath)
    );
  }

  if (assignment.visibility === "PRIVATE") {
    if (assignment.owner_id === user.id) return true;
    if (!assignmentPath || !userPath) return false;
    return (
      assignmentPath !== userPath &&
      isDescendantOrEqual(assignmentPath, userPath)
    );
  }

  return false;
};

const canEditAssignment = async (user, assignment) => {
  if (user.role === UserRole.ADMIN_COMPANY) return true;
  if (assignment.owner_id === user.id) return true;
  if (assignment.unit_id && (await isAncestorUnit(user.id, assignment.unit_id)))
    return true;
  return false;
};

const canCreateKPIAssignment = async (user, payload) => {
  // Admin has full permission
  if (user.role === UserRole.ADMIN_COMPANY) return true;

  // If assigning to a unit: user must be from ancestor unit OR be manager of that unit
  if (payload.unit_id) {
    // Check if user is from ancestor unit (not same unit)
    const isFromAncestorUnit =
      user.unit_id &&
      user.unit_id !== payload.unit_id &&
      (await isAncestorUnit(user.unit_id, payload.unit_id));

    const unit = await prisma.units.findUnique({
      where: { id: payload.unit_id },
      select: { manager_id: true },
    });
    const isManagerOfUnit = unit?.manager_id === user.id;

    return isFromAncestorUnit || isManagerOfUnit;
  }

  // If assigning to a user: user must be from ancestor unit of owner's unit OR be manager of owner's unit
  if (payload.owner_id) {
    const owner = await prisma.users.findUnique({
      where: { id: payload.owner_id },
      select: { unit_id: true },
    });
    if (!owner || !owner.unit_id) return false;

    // Check if user is from ancestor unit (not same unit)
    const isFromAncestorUnit =
      user.unit_id &&
      user.unit_id !== owner.unit_id &&
      (await isAncestorUnit(user.unit_id, owner.unit_id));

    const ownerUnit = await prisma.units.findUnique({
      where: { id: owner.unit_id },
      select: { manager_id: true },
    });
    const isManagerOfOwnerUnit = ownerUnit?.manager_id === user.id;

    return isFromAncestorUnit || isManagerOfOwnerUnit;
  }

  return false;
};

const canUpdateKPIAssignment = async (user, assignment) => {
  // Admin has full permission
  if (user.role === UserRole.ADMIN_COMPANY) return true;

  // If unit assignment: user must be from ancestor unit OR be manager of that unit
  if (assignment.unit_id) {
    // Check if user is from ancestor unit (not same unit)
    const isFromAncestorUnit =
      user.unit_id &&
      user.unit_id !== assignment.unit_id &&
      (await isAncestorUnit(user.unit_id, assignment.unit_id));

    const unit = await prisma.units.findUnique({
      where: { id: assignment.unit_id },
      select: { manager_id: true },
    });
    const isManagerOfUnit = unit?.manager_id === user.id;

    return isFromAncestorUnit || isManagerOfUnit;
  }

  // If user assignment: user must be from ancestor unit of owner's unit OR be manager of owner's unit
  if (assignment.owner_id) {
    const owner = await prisma.users.findUnique({
      where: { id: assignment.owner_id },
      select: { unit_id: true },
    });
    if (!owner || !owner.unit_id) return false;

    // Check if user is from ancestor unit (not same unit)
    const isFromAncestorUnit =
      user.unit_id &&
      user.unit_id !== owner.unit_id &&
      (await isAncestorUnit(user.unit_id, owner.unit_id));

    const ownerUnit = await prisma.units.findUnique({
      where: { id: owner.unit_id },
      select: { manager_id: true },
    });
    const isManagerOfOwnerUnit = ownerUnit?.manager_id === user.id;

    return isFromAncestorUnit || isManagerOfOwnerUnit;
  }

  return false;
};

// Helper function to recalculate current_value from children recursively
export const recalculateCurrentValueFromChildren = async (assignmentId) => {
  const children = await prisma.kPIAssignments.findMany({
    where: { parent_assignment_id: assignmentId, deleted_at: null },
    select: { id: true, current_value: true },
  });

  const totalCurrentValue = children.reduce(
    (sum, child) => sum + (child.current_value || 0),
    0,
  );

  // Get assignment to recalculate progress
  const assignment = await prisma.kPIAssignments.findUnique({
    where: { id: assignmentId },
    select: { kpi_dictionary_id: true, target_value: true, start_value: true },
  });

  if (!assignment) return;

  const dict = await prisma.kPIDictionaries.findUnique({
    where: { id: assignment.kpi_dictionary_id },
    select: { evaluation_method: true },
  });

  const progressPercentage = calculateProgressPercentage(
    totalCurrentValue,
    assignment.target_value,
    assignment.start_value,
    dict.evaluation_method,
  );

  // Update the assignment's current_value and progress
  await prisma.kPIAssignments.update({
    where: { id: assignmentId },
    data: {
      current_value: totalCurrentValue,
      progress_percentage: progressPercentage,
    },
  });

  // Recursively update parent
  const parentAssignment = await prisma.kPIAssignments.findUnique({
    where: { id: assignmentId },
    select: { parent_assignment_id: true },
  });

  if (parentAssignment?.parent_assignment_id) {
    await recalculateCurrentValueFromChildren(
      parentAssignment.parent_assignment_id,
    );
  }
};

// Helper function to build nested structure with sub_assignments
const buildNestedAssignments = async (assignments) => {
  // Map to store all assignments by id for easy lookup
  const assignmentMap = new Map();
  const rootAssignments = [];

  // Fetch all access_paths using raw SQL for each assignment
  const assignmentsWithPath = await Promise.all(
    assignments.map(async (a) => {
      const pathResult = await prisma.$queryRaw`
                SELECT access_path::text AS access_path
                FROM "KPIAssignments"
                WHERE id = ${a.id}
            `;
      return {
        ...a,
        access_path: pathResult[0]?.access_path || null,
      };
    }),
  );

  // Format all assignments and store in map
  const formatted = await Promise.all(
    assignmentsWithPath.map(async (a) => {
      const formattedAssignment = await formatAssignment(a);
      return {
        ...formattedAssignment,
        sub_assignments: [],
      };
    }),
  );

  formatted.forEach((a) => {
    assignmentMap.set(a.id, a);
  });

  // Build hierarchy
  formatted.forEach((a) => {
    if (!a.parent_assignment?.id) {
      // This is a root assignment
      rootAssignments.push(a);
    } else {
      // This is a child assignment
      const parent = assignmentMap.get(a.parent_assignment.id);
      if (parent) {
        parent.sub_assignments.push(a);
      }
    }
  });

  return rootAssignments;
};

export const listKPIAssignments = async (user, filters, mode = "tree") => {
  // Check if user can filter by status (only ADMIN_COMPANY or unit manager)
  const canFilterByStatus = async (user, unitId) => {
    if (user.role === UserRole.ADMIN_COMPANY) return true;
    if (!unitId || !user.unit_id) return false;
    // Check if user is manager of the unit
    const unit = await prisma.units.findUnique({
      where: { id: unitId },
      select: { manager_id: true },
    });
    if (unit?.manager_id === user.id) return true;
    // Check if user is from ancestor unit
    return await isAncestorUnit(user.unit_id, unitId);
  };

  // Validate status filter permission
  if (filters.status === "deleted") {
    const hasPermission = await canFilterByStatus(user, filters.unit_id);
    if (!hasPermission) {
      throw new AppError("You do not have permission to filter by status", 403);
    }
  }

  // Validate kpi_status filter permission (also requires manager/admin)
  if (filters.kpi_status) {
    const hasPermission = await canFilterByStatus(user, filters.unit_id);
    if (!hasPermission) {
      throw new AppError(
        "You do not have permission to filter by kpi_status",
        403,
      );
    }
  }

  const where = {
    deleted_at: filters.status === "deleted" ? { not: null } : null,
  };

  if (filters.cycle_id) where.cycle_id = filters.cycle_id;
  if (filters.visibility) where.visibility = filters.visibility;
  if (filters.parent_assignment_id !== undefined) {
    where.parent_assignment_id = filters.parent_assignment_id;
  }
  if (filters.unit_id) where.unit_id = filters.unit_id;
  if (filters.owner_id) where.owner_id = filters.owner_id;

  if (user.role !== UserRole.ADMIN_COMPANY) {
    // Get visible assignments based on permission logic
    const visibleIds = await prisma.kPIAssignments
      .findMany({
        where,
        select: { id: true },
      })
      .then(async (assignments) => {
        const visibleAssignments = [];
        for (const a of assignments) {
          const full = await prisma.kPIAssignments.findUnique({
            where: { id: a.id },
          });
          const allowed = await canViewAssignment(user, full);
          if (allowed) visibleAssignments.push(a.id);
        }
        return visibleAssignments;
      });

    where.id = { in: visibleIds };
  }

  // Get all assignments without pagination first (to build hierarchy)
  const allAssignments = await prisma.kPIAssignments.findMany({
    where,
    select: assignmentSelect,
    orderBy: { id: "asc" },
  });

  // Format all assignments first
  const formattedAssignments = await Promise.all(
    allAssignments.map(async (a) => {
      // Fetch access_path using raw SQL for ltree type support
      const pathResult = await prisma.$queryRaw`
                SELECT access_path::text AS access_path
                FROM "KPIAssignments"
                WHERE id = ${a.id}
            `;
      const assignmentWithPath = {
        ...a,
        access_path: pathResult[0]?.access_path || null,
      };
      return await formatAssignment(assignmentWithPath, user);
    }),
  );

  // Filter by progress_status if provided
  let filteredAssignments = formattedAssignments;
  if (filters.progress_status) {
    filteredAssignments = filteredAssignments.filter(
      (a) => a.progress_status === filters.progress_status,
    );
  }

  // Filter by kpi_status (from latest record) if provided
  if (filters.kpi_status) {
    filteredAssignments = filteredAssignments.filter(
      (a) => a.status === filters.kpi_status,
    );
  }

  // Flat list mode: return all assignments as flat list with pagination
  if (mode === "list") {
    const page = filters.page || 1;
    const per_page = filters.per_page || 20;
    const skip = (page - 1) * per_page;
    const total = filteredAssignments.length;
    const paginatedAssignments = filteredAssignments.slice(
      skip,
      skip + per_page,
    );

    return {
      data: paginatedAssignments,
      meta: {
        total,
        page,
        per_page,
        last_page: Math.ceil(total / per_page),
      },
    };
  }

  // Tree mode: build tree structure (default behavior)
  const assignmentMap = new Map();
  const assignmentsWithSubs = filteredAssignments.map((a) => ({
    ...a,
    sub_assignments: [],
  }));

  // Create map for quick lookup
  assignmentsWithSubs.forEach((a) => {
    assignmentMap.set(a.id, a);
  });

  // Build parent-child relationships
  const rootAssignments = [];
  assignmentsWithSubs.forEach((a) => {
    if (!a.parent_assignment || !a.parent_assignment.id) {
      rootAssignments.push(a);
    } else {
      const parent = assignmentMap.get(a.parent_assignment.id);
      if (parent) {
        parent.sub_assignments.push(a);
      }
    }
  });

  // Apply pagination on root assignments only
  const page = filters.page || 1;
  const per_page = filters.per_page || 20;
  const skip = (page - 1) * per_page;

  const paginatedRoots = rootAssignments.slice(skip, skip + per_page);
  const total = rootAssignments.length;

  return {
    data: paginatedRoots,
    meta: {
      total,
      page,
      per_page,
      last_page: Math.ceil(total / per_page),
    },
  };
};

export const createKPIAssignment = async (user, payload) => {
  // Check permission to create KPI assignment
  const allowed = await canCreateKPIAssignment(user, payload);
  if (!allowed) {
    throw new AppError(
      "You do not have permission to create this KPI assignment",
      403,
    );
  }

  const kpiDictionary = await prisma.kPIDictionaries.findFirst({
    where: {
      id: payload.kpi_dictionary_id,
      deleted_at: null,
    },
    select: { id: true, unit_id: true },
  });

  if (!kpiDictionary) throw new AppError("KPI Dictionary not found", 404);

  const cycle = await prisma.cycles.findFirst({
    where: { id: payload.cycle_id, company_id: user.company_id },
    select: { id: true, is_locked: true },
  });

  if (!cycle) throw new AppError("Cycle not found", 404);
  if (cycle.is_locked) throw new AppError("Cycle is locked and cannot be modified", 400, "CYCLE_LOCKED");

  // Validate owner_id and unit_id are provided and mutually exclusive
  if (!payload.owner_id && !payload.unit_id) {
    throw new AppError("Either owner_id or unit_id must be provided", 422);
  }

  let unitId, ownerId;

  if (payload.owner_id) {
    const owner = await prisma.users.findFirst({
      where: { id: payload.owner_id },
      select: { id: true, unit_id: true },
    });
    if (!owner) throw new AppError("Owner not found", 404);
    ownerId = owner.id;
    unitId = owner.unit_id;
  } else {
    const unit = await prisma.units.findFirst({
      where: { id: payload.unit_id },
      select: { id: true },
    });
    if (!unit) throw new AppError("Unit not found", 404);
    unitId = unit.id;
  }

  // Check KPI dictionary is accessible for this unit
  if (
    kpiDictionary.unit_id &&
    !(await isAncestorUnit(kpiDictionary.unit_id, unitId))
  ) {
    throw new AppError(
      "This KPI Dictionary is not accessible for the selected unit",
      400,
    );
  }

  // Validate parent_assignment_id if provided
  if (payload.parent_assignment_id) {
    const parentAssignment = await prisma.kPIAssignments.findFirst({
      where: {
        id: payload.parent_assignment_id,
        deleted_at: null,
      },
      select: { kpi_dictionary_id: true },
    });

    if (!parentAssignment)
      throw new AppError("Parent assignment not found", 404);
    if (parentAssignment.kpi_dictionary_id !== payload.kpi_dictionary_id) {
      throw new AppError(
        "Parent assignment must use the same KPI Dictionary",
        400,
      );
    }
  }

  const accessPath = await getUnitPath(unitId);
  if (!accessPath) throw new AppError("Unit not found", 404);

  const visibility = payload.visibility || "PUBLIC";

  // Use raw SQL to insert since access_path is ltree type which Prisma doesn't natively support
  const startValue = payload.start_value ?? payload.current_value ?? 0;
  const currentValue = payload.current_value ?? 0;

  const created = await prisma.$queryRaw`
        INSERT INTO "KPIAssignments" (
            company_id,
            kpi_dictionary_id,
            cycle_id,
            target_value,
            start_value,
            current_value,
            unit_id,
            owner_id,
            parent_assignment_id,
            visibility,
            access_path,
            due_date,
            progress_percentage,
            created_at
        ) VALUES (
            ${user.company_id},
            ${payload.kpi_dictionary_id},
            ${payload.cycle_id},
            ${payload.target_value},
            ${startValue},
            ${currentValue},
            ${unitId},
            ${ownerId},
            ${payload.parent_assignment_id ?? null},
            ${visibility},
            ${accessPath}::ltree,
            ${payload.due_date ? new Date(payload.due_date) : null},
            0,
            NOW()
        )
        RETURNING
            id,
            kpi_dictionary_id,
            cycle_id,
            target_value,
            start_value,
            current_value,
            progress_percentage,
            visibility,
            owner_id,
            unit_id,
            parent_assignment_id,
            due_date,
            access_path::text,
            created_at
    `;

  const result = await formatAssignment(created[0], user);

    // If parent_assignment_id is provided, recalculate parent's current_value
    if (payload.parent_assignment_id) {
        await recalculateCurrentValueFromChildren(payload.parent_assignment_id);
    }

    // Notify users about new KPI assignment
    try {
        const kpiDictionary = await prisma.kPIDictionaries.findUnique({
            where: { id: payload.kpi_dictionary_id },
            select: { name: true },
        });

        await notifyKPIAssignmentEvent({
            companyId: user.company_id,
            eventType: "CREATED",
            assignment: {
                id: created[0].id,
                unit_id: unitId,
                owner_id: ownerId,
            },
            kpiName: kpiDictionary?.name || "KPI Assignment",
            actorName: user.full_name || user.email,
            actorId: user.id,
        });
    } catch (error) {
        // Log error but don't fail the main operation
        console.error("Failed to send KPI assignment notification:", error);
    }

  return result;
};

export const updateKPIAssignment = async (user, assignmentId, payload) => {
  const assignment = await prisma.kPIAssignments.findFirst({
    where: { id: assignmentId, deleted_at: null },
    select: { id: true, cycle_id: true, kpi_dictionary_id: true, unit_id: true, owner_id: true, target_value: true, start_value: true, current_value: true },
  });

  if (!assignment) throw new AppError("KPI Assignment not found", 404);

  // Check if current cycle is locked
  const currentCycle = await prisma.cycles.findFirst({
    where: { id: assignment.cycle_id, company_id: user.company_id },
    select: { is_locked: true },
  });
  if (currentCycle?.is_locked) {
    throw new AppError("Cycle is locked and cannot be modified", 400, "CYCLE_LOCKED");
  }

  const allowed = await canUpdateKPIAssignment(user, assignment);
  if (!allowed)
    throw new AppError(
      "You do not have permission to edit this assignment",
      403,
    );

  const updates = {};

  if (payload.cycle_id !== undefined) {
    const cycle = await prisma.cycles.findFirst({
      where: { id: payload.cycle_id, company_id: user.company_id },
      select: { id: true, is_locked: true },
    });
    if (!cycle) throw new AppError("Cycle not found", 404);
    if (cycle.is_locked) throw new AppError("Target cycle is locked and cannot be modified", 400, "CYCLE_LOCKED");
    updates.cycle_id = payload.cycle_id;
  }

  if (payload.target_value !== undefined) {
    updates.target_value = payload.target_value;
  }

  if (payload.current_value !== undefined) {
    // Check if this assignment has children
    const hasChildren = await prisma.kPIAssignments.findFirst({
      where: { parent_assignment_id: assignmentId, deleted_at: null },
    });

    if (hasChildren) {
      throw new AppError(
        "Cannot update current_value for assignment with children. Current value is calculated from children.",
        400,
      );
    }

    // Only allow updating current_value if no KPI records exist
    const existingRecords = await prisma.kPIRecords.findFirst({
      where: { kpi_assignment_id: assignmentId },
    });

    if (existingRecords) {
      throw new AppError(
        "Cannot update current_value when KPI records exist",
        400,
      );
    }

    updates.current_value = payload.current_value;
  }

  if (payload.visibility !== undefined) {
    updates.visibility = payload.visibility;
  }

  if (payload.due_date !== undefined) {
    updates.due_date = payload.due_date ? new Date(payload.due_date) : null;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No fields provided to update", 400);
  }

  // Recalculate progress if target_value or current_value changed
  if (
    updates.target_value !== undefined ||
    updates.current_value !== undefined
  ) {
    const dict = await prisma.kPIDictionaries.findUnique({
      where: { id: assignment.kpi_dictionary_id },
      select: { evaluation_method: true },
    });

    const targetValue = updates.target_value ?? assignment.target_value;
    const currentValue = updates.current_value ?? assignment.current_value;
    const startValue = assignment.start_value ?? 0;

    updates.progress_percentage = calculateProgressPercentage(
      currentValue,
      targetValue,
      startValue,
      dict.evaluation_method,
    );
  }

  const updated = await prisma.kPIAssignments.update({
    where: { id: assignmentId },
    data: updates,
    select: assignmentSelect,
  });

  // If current_value was updated, recalculate all ancestors
  if (updates.current_value !== undefined) {
    const parent = await prisma.kPIAssignments.findUnique({
      where: { id: assignmentId },
      select: { parent_assignment_id: true },
    });

    if (parent?.parent_assignment_id) {
      await recalculateCurrentValueFromChildren(parent.parent_assignment_id);
    }
  }

  // Fetch access_path using raw SQL for ltree type support
  const pathResult = await prisma.$queryRaw`
        SELECT access_path::text AS access_path
        FROM "KPIAssignments"
        WHERE id = ${assignmentId}
    `;

    const updatedWithPath = {
        ...updated,
        access_path: pathResult[0]?.access_path || null,
    };

    // Notify users about KPI assignment update
    try {
        const kpiDictionary = await prisma.kPIDictionaries.findUnique({
            where: { id: assignment.kpi_dictionary_id },
            select: { name: true },
        });

        await notifyKPIAssignmentEvent({
            companyId: user.company_id,
            eventType: "UPDATED",
            assignment: {
                id: assignmentId,
                unit_id: assignment.unit_id,
                owner_id: assignment.owner_id,
            },
            kpiName: kpiDictionary?.name || "KPI Assignment",
            actorName: user.full_name || user.email,
            actorId: user.id,
        });
    } catch (error) {
        // Log error but don't fail the main operation
        console.error("Failed to send KPI assignment notification:", error);
    }

  return await formatAssignment(updatedWithPath, user);
};

export const deleteKPIAssignment = async (
  user,
  assignmentId,
  cascade = false,
) => {
  const assignment = await prisma.kPIAssignments.findFirst({
    where: { id: assignmentId, deleted_at: null },
  });

  if (!assignment) throw new AppError("KPI Assignment not found", 404);

    const allowed = await canUpdateKPIAssignment(user, assignment);
    if (!allowed) throw new AppError("You do not have permission to delete this assignment", 403);

    // Get KPI name for notification before deletion
    let kpiName = "KPI Assignment";
    try {
        const kpiDictionary = await prisma.kPIDictionaries.findUnique({
            where: { id: assignment.kpi_dictionary_id },
            select: { name: true },
        });
        if (kpiDictionary?.name) kpiName = kpiDictionary.name;
    } catch (error) {
        // Ignore error, use default name
    }

  const parentAssignmentId = assignment.parent_assignment_id;

  if (cascade) {
    // Recursively soft delete all descendants
    const softDeleteDescendantsRecursively = async (parentId) => {
      // Find all direct children
      const children = await prisma.kPIAssignments.findMany({
        where: { parent_assignment_id: parentId, deleted_at: null },
        select: { id: true },
      });

      // Recursively soft delete all children
      for (const child of children) {
        await softDeleteDescendantsRecursively(child.id);
      }

      // Soft delete the parent
      await prisma.kPIAssignments.update({
        where: { id: parentId },
        data: { deleted_at: new Date() },
      });
    };

    await softDeleteDescendantsRecursively(assignmentId);
  } else {
    // Only soft delete the assignment itself
    await prisma.kPIAssignments.update({
      where: { id: assignmentId },
      data: { deleted_at: new Date() },
    });
  }

    // If parent exists, recalculate its current_value
    if (parentAssignmentId) {
        await recalculateCurrentValueFromChildren(parentAssignmentId);
    }

    // Notify users about KPI assignment deletion
    try {
        await notifyKPIAssignmentEvent({
            companyId: user.company_id,
            eventType: "DELETED",
            assignment: {
                id: assignmentId,
                unit_id: assignment.unit_id,
                owner_id: assignment.owner_id,
            },
            kpiName: kpiName,
            actorName: user.full_name || user.email,
            actorId: user.id,
        });
    } catch (error) {
        // Log error but don't fail the main operation
        console.error("Failed to send KPI assignment notification:", error);
    }
};

export const getKPIAssignmentById = async (user, assignmentId) => {
  const assignment = await prisma.kPIAssignments.findFirst({
    where: { id: assignmentId, deleted_at: null },
    select: assignmentSelect,
  });

  if (!assignment) throw new AppError("KPI Assignment not found", 404);

  // Fetch access_path using raw SQL for ltree type support
  const pathResult = await prisma.$queryRaw`
        SELECT access_path::text AS access_path
        FROM "KPIAssignments"
        WHERE id = ${assignmentId}
    `;

  const assignmentWithPath = {
    ...assignment,
    access_path: pathResult[0]?.access_path || null,
  };

  // Check if user can view this assignment
  const canView = await canViewAssignment(user, assignmentWithPath);
  if (!canView) {
    throw new AppError(
      "You do not have permission to view this KPI assignment",
      403,
    );
  }

  return await formatAssignment(assignmentWithPath, user);
};

/**
 * Get available KPI Assignments that can be set as parent for a new KPI in a specific unit
 * Returns assignments from the specified unit and all its ancestor units
 * Only includes assignments with the same KPI dictionary that don't already have a parent
 */
export const getAvailableParentKPIs = async (user, unitId, kpiDictionaryId) => {
  // Validate unit exists
  const unit = await prisma.units.findFirst({
    where: { id: unitId },
    select: { id: true },
  });
  if (!unit) throw new AppError("Unit not found", 404);

  // Get ancestor unit IDs (including current unit)
  const ancestorUnitIds = await getUnitAncestors(unitId);
  const relevantUnitIds = [unitId, ...ancestorUnitIds];

  // Get all assignments from relevant units with the same KPI dictionary
  // that don't already have a parent (only root assignments can be parents)
  const where = {
    deleted_at: null,
    unit_id: { in: relevantUnitIds },
  };

  // If kpiDictionaryId is provided, filter by it
  if (kpiDictionaryId) {
    where.kpi_dictionary_id = kpiDictionaryId;
  }

  const assignments = await prisma.kPIAssignments.findMany({
    where,
    select: assignmentSelect,
    orderBy: [{ unit_id: "asc" }, { created_at: "desc" }],
  });

  // Filter by visibility permissions
  const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;
  const unitPaths = await Promise.all(
    relevantUnitIds.map(async (id) => ({
      id,
      path: await getUnitPath(id),
    })),
  );
  const unitPathMap = new Map(unitPaths.map((u) => [u.id, u.path]));

  const visibleAssignments = [];
  for (const assignment of assignments) {
    // Admin can see all
    if (user.role === UserRole.ADMIN_COMPANY) {
      visibleAssignments.push(assignment);
      continue;
    }

    // PUBLIC visibility - visible to all
    if (assignment.visibility === "PUBLIC") {
      visibleAssignments.push(assignment);
      continue;
    }

    const assignmentPath = unitPathMap.get(assignment.unit_id);
    if (!assignmentPath || !userPath) continue;

    // INTERNAL visibility - visible if user is in same unit hierarchy
    if (assignment.visibility === "INTERNAL") {
      if (
        isAncestorOrEqual(assignmentPath, userPath) ||
        isDescendantOrEqual(assignmentPath, userPath)
      ) {
        visibleAssignments.push(assignment);
      }
      continue;
    }

    // PRIVATE visibility - visible to owner or ancestor units
    if (assignment.visibility === "PRIVATE") {
      if (assignment.owner_id === user.id) {
        visibleAssignments.push(assignment);
        continue;
      }
      if (
        assignmentPath !== userPath &&
        isDescendantOrEqual(assignmentPath, userPath)
      ) {
        visibleAssignments.push(assignment);
      }
    }
  }

  // Format all visible assignments
  const formattedAssignments = await Promise.all(
    visibleAssignments.map(async (a) => {
      // Fetch access_path using raw SQL for ltree type support
      const pathResult = await prisma.$queryRaw`
                SELECT access_path::text AS access_path
                FROM "KPIAssignments"
                WHERE id = ${a.id}
            `;
      const assignmentWithPath = {
        ...a,
        access_path: pathResult[0]?.access_path || null,
      };
      return await formatAssignment(assignmentWithPath, user);
    }),
  );

  // Group by unit for better organization in response
  const groupedByUnit = formattedAssignments.reduce((acc, assignment) => {
    const unitKey = assignment.unit?.id?.toString() || "unknown";
    if (!acc[unitKey]) {
      acc[unitKey] = {
        unit: assignment.unit,
        assignments: [],
      };
    }
    acc[unitKey].assignments.push(assignment);
    return acc;
  }, {});

  return {
    unit_id: unitId,
    unit_ids_searched: relevantUnitIds,
    kpi_dictionary_id: kpiDictionaryId || null,
    total: formattedAssignments.length,
    data: Object.values(groupedByUnit),
  };
};
