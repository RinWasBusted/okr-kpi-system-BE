// Behavior AI validation schemas
export const getRiskScoresSchema = {
  user_id: "optional",
  start_date: "optional",
  end_date: "optional",
  min_score: "optional"
};

export const getEmployeeFeaturesSchema = {
  userId: "required",
  days: "optional"
};

export const predictEmployeeRiskSchema = {
  userId: "required"
};