import prisma from "../../../utils/prisma.js";
import AppError from "../../../utils/appError.js";
import { getUnitPath, getUnitAncestors, getUnitDescendants } from "../../../utils/path.js";
import { UserRole } from "@prisma/client";

const dictionarySelect = {
    id: true,
    name: true,
    unit: true,
    evaluation_method: true,
    description: true,
    unit_id: true,
};

const formatDictionary = (dict, currentUser = null) => {
    const isAdmin = currentUser?.role === UserRole.ADMIN_COMPANY;

    const result = {
        id: dict.id,
        name: dict.name,
        unit: dict.unit,
        evaluation_method: dict.evaluation_method,
        description: dict.description ?? null,
        unit_id: dict.unit_id,
    };

    // Only add permission for ADMIN_COMPANY
    if (isAdmin) {
        result.permission = {
            editable: true,
            deletable: true,
        };
    }

    return result;
};

export const listKPIDictionaries = async (user, forUnitId = null) => {
    // If forUnitId is provided, filter dictionaries accessible to that specific unit
    // (company-wide + unit itself + ancestor units)
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

        return dictionaries.map(dict => formatDictionary(dict, user));
    }

    if (user.role === UserRole.ADMIN_COMPANY) {
        // AdminCompany sees all non-deleted dictionaries
        const dictionaries = await prisma.kPIDictionaries.findMany({
            where: {
                deleted_at: null,
            },
            select: dictionarySelect,
            orderBy: { id: "asc" },
        });

        return dictionaries.map(dict => formatDictionary(dict, user));
    }

    // Employee sees company-wide dictionaries and their unit + parent units
    const userPath = user.unit_id ? await getUnitPath(user.unit_id) : null;
    const accessibleUnitIds = userPath ? await getUnitAncestors(user.unit_id) : [];
    const unitIds = userPath ? [user.unit_id, ...accessibleUnitIds] : [];

    const dictionaries = await prisma.kPIDictionaries.findMany({
        where: {
            deleted_at: null,
            OR: [
                { unit_id: null }, // Company-wide
                { unit_id: { in: unitIds } }, // User's unit and parent units
            ],
        },
        select: dictionarySelect,
        orderBy: { id: "asc" },
    });

    return dictionaries.map(dict => formatDictionary(dict, user));
};

export const createKPIDictionary = async (user, payload) => {
    if (user.role !== UserRole.ADMIN_COMPANY) {
        throw new AppError("Only admin can create KPI dictionaries", 403);
    }

    // Validate unit_id if provided
    if (payload.unit_id) {
        const unit = await prisma.units.findFirst({
            where: { id: payload.unit_id },
            select: { id: true },
        });
        if (!unit) throw new AppError("Unit not found", 404);
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

    return formatDictionary(created);
};

export const updateKPIDictionary = async (user, dictionaryId, payload) => {
    if (user.role !== UserRole.ADMIN_COMPANY) {
        throw new AppError("Only admin can update KPI dictionaries", 403);
    }

    const dictionary = await prisma.kPIDictionaries.findFirst({
        where: { id: dictionaryId },
        select: { id: true, deleted_at: true },
    });

    if (!dictionary) throw new AppError("KPI Dictionary not found", 404);
    if (dictionary.deleted_at) throw new AppError("Cannot update deleted KPI Dictionary", 400);

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

    return formatDictionary(updated);
};

export const deleteKPIDictionary = async (user, dictionaryId) => {
    if (user.role !== UserRole.ADMIN_COMPANY) {
        throw new AppError("Only admin can delete KPI dictionaries", 403);
    }

    const dictionary = await prisma.kPIDictionaries.findFirst({
        where: { id: dictionaryId },
        select: { id: true, deleted_at: true },
    });

    if (!dictionary) throw new AppError("KPI Dictionary not found", 404);
    if (dictionary.deleted_at) throw new AppError("KPI Dictionary already deleted", 400);

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
