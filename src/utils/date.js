export const toDateOnlyUtc = (date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const daysBetweenUtc = (endDate, startDate) => {
    const end = toDateOnlyUtc(endDate);
    const start = toDateOnlyUtc(startDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};

export default {
    toDateOnlyUtc,
    daysBetweenUtc,
};