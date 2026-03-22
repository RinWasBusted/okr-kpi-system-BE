import prisma from "../../utils/prisma.js";
import AppError from "../../utils/appError.js";
import { UserRole } from "@prisma/client";

const unitSelect = {
    id: true,
    name: true,
    parent_id: true,
    created_at: true,
    manager: {
        select: {
            id: true,
            full_name: true,
        },
    },
    _count: {
        select: {
            users: true,
        },
    },
};

const formatUnit = (unit) => ({
    id: unit.id,
    name: unit.name,
    parent_id: unit.parent_id ?? null,
    manager: unit.manager ?? null,
    member_count: unit._count.users,
    created_at: unit.created_at,
});

// ─── List ────────────────────────────────────────────────────────────────────

export const listUnits = async ({ page, per_page }) => {
    const [total, units] = await Promise.all([
        prisma.units.count(),
        prisma.units.findMany({
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: { id: "asc" },
            select: unitSelect,
        }),
    ]);

    return { total, data: units.map(formatUnit) };
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createUnit = async (companyId, { name, parent_id, manager_id }) => {
    if (parent_id !== undefined && parent_id !== null) {
        const parent = await prisma.units.findFirst({
            where: { id: parent_id },
        });
        if (!parent) throw new AppError("Parent unit not found", 404);
    }

    if (manager_id !== undefined && manager_id !== null) {
        const manager = await prisma.users.findFirst({
            where: { id: manager_id, role: UserRole.EMPLOYEE },
        });
        if (!manager) throw new AppError("Manager not found in this company", 404);
    }

    const unit = await prisma.units.create({
        data: {
            company_id: companyId,
            name,
            parent_id: parent_id ?? null,
            manager_id: manager_id ?? null,
        },
        select: unitSelect,
    });

    return formatUnit(unit);
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateUnit = async (unitId, { name, parent_id, manager_id }) => {
    const existing = await prisma.units.findFirst({
        where: { id: unitId },
    });
    if (!existing) throw new AppError("Unit not found", 404);

    if (parent_id !== undefined && parent_id !== null) {
        if (parent_id === unitId) throw new AppError("Unit cannot be its own parent", 400);

        const parent = await prisma.units.findFirst({
            where: { id: parent_id },
        });
        if (!parent) throw new AppError("Parent unit not found", 404);

        // Prevent circular hierarchy: check that unitId is not an ancestor of parent_id
        const isCircular = await isAncestor(unitId, parent_id);
        if (isCircular) throw new AppError("Circular unit hierarchy is not allowed", 400);
    }

    if (manager_id !== undefined && manager_id !== null) {
        const manager = await prisma.users.findFirst({
            where: { id: manager_id, role: UserRole.EMPLOYEE },
        });
        if (!manager) throw new AppError("Manager not found in this company", 404);
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (parent_id !== undefined) updates.parent_id = parent_id ?? null;
    if (manager_id !== undefined) updates.manager_id = manager_id ?? null;

    if (Object.keys(updates).length === 0) {
        throw new AppError("No fields provided to update", 400);
    }

    const updated = await prisma.units.update({
        where: { id: unitId },
        data: updates,
        select: unitSelect,
    });

    return formatUnit(updated);
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteUnit = async (unitId) => {
    const unit = await prisma.units.findFirst({
        where: { id: unitId },
        include: {
            _count: {
                select: {
                    users: true,
                    children: true,
                },
            },
        },
    });

    if (!unit) throw new AppError("Unit not found", 404);
    if (unit._count.users > 0) throw new AppError("Unit still has members and cannot be deleted", 400);
    if (unit._count.children > 0) throw new AppError("Unit still has child units and cannot be deleted", 400);

    await prisma.units.delete({ where: { id: unitId } });
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isAncestor = async (potentialAncestorId, nodeId) => {
    let currentId = nodeId;
    const visited = new Set();

    while (currentId !== null && currentId !== undefined) {
        if (visited.has(currentId)) break; // safety guard against existing cycles
        visited.add(currentId);

        if (currentId === potentialAncestorId) return true;

        const node = await prisma.units.findFirst({
            where: { id: currentId },
            select: { parent_id: true },
        });

        currentId = node?.parent_id ?? null;
    }

    return false;
};
