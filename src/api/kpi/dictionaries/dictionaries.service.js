import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { getUnitPath, getUnitAncestors, getUnitDescendants, isUnitManager } from "../../../utils/path.js";
import { UserRole } from "@prisma/client";

const dictionarySelect = {
    id: true,
    name: true,
    unit: true,
    evaluation_method: true,
    description: true,
    unit_id: true,
    unit_ref: {
        select: {
            id: true,
            name: true,
        },
    },
};

const formatDictionary = (dict, currentUser = null, userManagedUnitIds = []) => {
    const isAdmin = currentUser?.role === UserRole.ADMIN_COMPANY;

    const result = {
        id: dict.id,
        name: dict.name,
        unit: dict.unit,
        evaluation_method: dict.evaluation_method,
        description: dict.description ?? null,
        unit_id: dict.unit_id,
        org_unit: dict.unit_ref ? { id: dict.unit_ref.id, name: dict.unit_ref.name } : null,
    };

    // Determine if user can edit/delete this dictionary
    let isEditable = false;
    let isDeletable = false;

    if (isAdmin) {
        // Admin can edit/delete all dictionaries
        isEditable = true;
        isDeletable = true;
    } else if (dict.unit_id) {
        // For unit-specific dictionary, check if user manages this unit
        isEditable = userManagedUnitIds.includes(dict.unit_id);
        isDeletable = userManagedUnitIds.includes(dict.unit_id);
    }
    // For company-wide dictionary (unit_id is null), non-admin cannot edit/delete

    // Only add permission if user has at least one of editable/deletable rights
    if (isEditable || isDeletable) {
        result.permission = {
            editable: isEditable,
            deletable: isDeletable,
        };
    }

    return result;
};

export const listKPIDictionaries = async (user, forUnitId = null) => {
    // Get all units managed by current user for permission checking
    const userManagedUnits = await prisma.units.findMany({
        where: { manager_id: user.id, deleted_at: null },
        select: { id: true },
    });
    const userManagedUnitIds = userManagedUnits.map(u => u.id);

    // Determine which unit to use for filtering
    const targetUnitId = forUnitId || user.unit_id;

    if (user.role === UserRole.ADMIN_COMPANY) {
        // AdminCompany sees all non-deleted dictionaries
        const dictionaries = await prisma.kPIDictionaries.findMany({
            where: {
                deleted_at: null,
            },
            select: dictionarySelect,
            orderBy: { id: "asc" },
        });

        return dictionaries.map(dict => formatDictionary(dict, user, userManagedUnitIds));
    }

    // For employee: get dictionaries for target unit's entire branch (ancestors + current + descendants)
    if (targetUnitId) {
        // Get ancestor unit IDs
        const ancestorUnitIds = await getUnitAncestors(targetUnitId);
        // Get descendant unit IDs
        const descendantUnitIds = await getUnitDescendants(targetUnitId);
        // Combine: target + ancestors + descendants
        const unitBranchIds = [targetUnitId, ...ancestorUnitIds, ...descendantUnitIds];

        const dictionaries = await prisma.kPIDictionaries.findMany({
            where: {
                deleted_at: null,
                OR: [
                    { unit_id: null }, // Company-wide
                    { unit_id: { in: unitBranchIds } }, // Unit branch dictionaries
                ],
            },
            select: dictionarySelect,
            orderBy: { id: "asc" },
        });

        return dictionaries.map(dict => formatDictionary(dict, user, userManagedUnitIds));
    }

    // Employee with no unit_id: only sees company-wide dictionaries
    const dictionaries = await prisma.kPIDictionaries.findMany({
        where: {
            deleted_at: null,
            unit_id: null, // Company-wide only
        },
        select: dictionarySelect,
        orderBy: { id: "asc" },
    });

    return dictionaries.map(dict => formatDictionary(dict, user, userManagedUnitIds));
};

export const getKPIDictionariesForUnitAssignment = async (user, forUnitId) => {
    // Get all units managed by current user for permission checking
    const userManagedUnits = await prisma.units.findMany({
        where: { manager_id: user.id, deleted_at: null },
        select: { id: true },
    });
    const userManagedUnitIds = userManagedUnits.map(u => u.id);

    if (user.role === UserRole.ADMIN_COMPANY) {
        // AdminCompany sees all non-deleted dictionaries
        const dictionaries = await prisma.kPIDictionaries.findMany({
            where: {
                deleted_at: null,
            },
            select: dictionarySelect,
            orderBy: { id: "asc" },
        });

        return dictionaries.map(dict => formatDictionary(dict, user, userManagedUnitIds));
    }

    // For employee: get dictionaries accessible for this unit
    // (company-wide + unit itself + ancestor units only, NOT descendants)
    if (forUnitId) {
        const unitPath = await getUnitPath(forUnitId);
        const ancestorUnitIds = unitPath ? await getUnitAncestors(forUnitId) : [];
        const accessibleUnitIds = [forUnitId, ...ancestorUnitIds];

        const dictionaries = await prisma.kPIDictionaries.findMany({
            where: {
                deleted_at: null,
                OR: [
                    { unit_id: null }, // Company-wide
                    { unit_id: { in: accessibleUnitIds } }, // Target unit and ancestor units
                ],
            },
            select: dictionarySelect,
            orderBy: { id: "asc" },
        });

        return dictionaries.map(dict => formatDictionary(dict, user, userManagedUnitIds));
    }

    // No unit specified: only company-wide
    const dictionaries = await prisma.kPIDictionaries.findMany({
        where: {
            deleted_at: null,
            unit_id: null,
        },
        select: dictionarySelect,
        orderBy: { id: "asc" },
    });

    return dictionaries.map(dict => formatDictionary(dict, user, userManagedUnitIds));
};

export const createKPIDictionary = async (user, payload) => {
    // Check permissions based on unit_id
    if (payload.unit_id) {
        // For unit-specific dictionary, user must be manager of this unit or ancestor manager
        const unit = await prisma.units.findFirst({
            where: { id: payload.unit_id },
            select: { id: true },
        });
        if (!unit) throw new AppError("Unit not found", 404);

        // Get ancestor unit IDs
        const ancestorUnitIds = await getUnitAncestors(payload.unit_id);
        const relevantUnitIds = [payload.unit_id, ...ancestorUnitIds];

        // Check if user is manager of this unit or any ancestor unit
        const userManagedUnit = await prisma.units.findFirst({
            where: {
                id: { in: relevantUnitIds },
                manager_id: user.id,
            },
            select: { id: true },
        });

        const isManager = !!userManagedUnit;
        const isAdmin = user.role === UserRole.ADMIN_COMPANY;

        if (!isManager && !isAdmin) {
            throw new AppError(
                "Phải là quản lý của đơn vị hoặc cấp trên hoặc là admin công ty thì mới tạo được mẫu KPI cho đơn vị này",
                403
            );
        }
    } else {
        // For company-wide dictionary, only admin can create
        if (user.role !== UserRole.ADMIN_COMPANY) {
            throw new AppError("Only admin can create company-wide KPI dictionaries", 403);
        }
    }

    const created = await prisma.kPIDictionaries.create({
        data: {
            company_id: user.company_id,
            name: payload.name,
            unit: payload.unit,
            evaluation_method: payload.evaluation_method,
            description: payload.description ?? null,
            unit_id: payload.unit_id ?? null,
        },
        select: dictionarySelect,
    });

    // For create response, get user's managed units for permission display
    const userManagedUnits = await prisma.units.findMany({
        where: { manager_id: user.id, deleted_at: null },
        select: { id: true },
    });
    const userManagedUnitIds = userManagedUnits.map(u => u.id);

    return formatDictionary(created, user, userManagedUnitIds);
};

export const updateKPIDictionary = async (user, dictionaryId, payload) => {
    const dictionary = await prisma.kPIDictionaries.findFirst({
        where: { id: dictionaryId },
        select: { id: true, deleted_at: true, unit_id: true },
    });

    if (!dictionary) throw new AppError("KPI Dictionary not found", 404);
    if (dictionary.deleted_at) throw new AppError("Cannot update deleted KPI Dictionary", 400);

    // Check permissions based on dictionary's unit_id
    if (dictionary.unit_id) {
        // For unit-specific dictionary, user must be manager of this unit or ancestor manager
        const ancestorUnitIds = await getUnitAncestors(dictionary.unit_id);
        const relevantUnitIds = [dictionary.unit_id, ...ancestorUnitIds];

        const userManagedUnit = await prisma.units.findFirst({
            where: {
                id: { in: relevantUnitIds },
                manager_id: user.id,
            },
            select: { id: true },
        });

        const isManager = !!userManagedUnit;
        const isAdmin = user.role === UserRole.ADMIN_COMPANY;

        if (!isManager && !isAdmin) {
            throw new AppError(
                "Phải là quản lý của đơn vị hoặc cấp trên hoặc là admin công ty thì mới cập nhật được mẫu KPI cho đơn vị này",
                403
            );
        }
    } else {
        // For company-wide dictionary, only admin can update
        if (user.role !== UserRole.ADMIN_COMPANY) {
            throw new AppError("Only admin can update company-wide KPI dictionaries", 403);
        }
    }

    // Validate unit_id if provided and not null
    if (payload.unit_id !== undefined && payload.unit_id !== null) {
        const unit = await prisma.units.findFirst({
            where: { id: payload.unit_id },
            select: { id: true },
        });
        if (!unit) throw new AppError("Unit not found", 404);
    }

    const updated = await prisma.kPIDictionaries.update({
        where: { id: dictionaryId },
        data: {
            ...(payload.name !== undefined && { name: payload.name }),
            ...(payload.unit !== undefined && { unit: payload.unit }),
            ...(payload.evaluation_method !== undefined && {
                evaluation_method: payload.evaluation_method,
            }),
            ...(payload.description !== undefined && { description: payload.description }),
            ...(payload.unit_id !== undefined ? {unit_id: payload.unit_id} : { unit_id: null }),
        },
        select: dictionarySelect,
    });

    // For update response, get user's managed units for permission display
    const userManagedUnits = await prisma.units.findMany({
        where: { manager_id: user.id, deleted_at: null },
        select: { id: true },
    });
    const userManagedUnitIds = userManagedUnits.map(u => u.id);

    return formatDictionary(updated, user, userManagedUnitIds);
};

export const deleteKPIDictionary = async (user, dictionaryId) => {
    const dictionary = await prisma.kPIDictionaries.findFirst({
        where: { id: dictionaryId },
        select: { id: true, deleted_at: true, unit_id: true },
    });

    if (!dictionary) throw new AppError("KPI Dictionary not found", 404);
    if (dictionary.deleted_at) throw new AppError("KPI Dictionary already deleted", 400);

    // Check permissions based on dictionary's unit_id
    if (dictionary.unit_id) {
        // For unit-specific dictionary, user must be manager of this unit or ancestor manager
        const ancestorUnitIds = await getUnitAncestors(dictionary.unit_id);
        const relevantUnitIds = [dictionary.unit_id, ...ancestorUnitIds];

        const userManagedUnit = await prisma.units.findFirst({
            where: {
                id: { in: relevantUnitIds },
                manager_id: user.id,
            },
            select: { id: true },
        });

        const isManager = !!userManagedUnit;
        const isAdmin = user.role === UserRole.ADMIN_COMPANY;

        if (!isManager && !isAdmin) {
            throw new AppError(
                "Phải là quản lý của đơn vị hoặc cấp trên hoặc là admin công ty thì mới xóa được mẫu KPI cho đơn vị này",
                403
            );
        }
    } else {
        // For company-wide dictionary, only admin can delete
        if (user.role !== UserRole.ADMIN_COMPANY) {
            throw new AppError("Only admin can delete company-wide KPI dictionaries", 403);
        }
    }

    // Check if any KPI assignments use this dictionary
    const assignment = await prisma.kPIAssignments.findFirst({
        where: { kpi_dictionary_id: dictionaryId },
        select: { id: true },
    });

    if (assignment) {
        throw new AppError(
            "Cannot delete KPI Dictionary that has active KPI Assignments",
            400,
        );
    }

    // Soft delete
    await prisma.kPIDictionaries.update({
        where: { id: dictionaryId },
        data: { deleted_at: new Date() },
    });
};
