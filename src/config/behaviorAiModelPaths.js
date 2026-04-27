import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const preferredModelDir = path.resolve(__dirname, "../../artifacts/behavior-ai");
const legacyModelDir = path.resolve(__dirname, "../../models");

function hasRequiredModelFiles(dirPath) {
  const featureColumnsPath = path.join(dirPath, "feature_columns.pkl");
  const modelPath = path.join(dirPath, "model.pkl");
  const legacyModelPath = path.join(dirPath, "knn_risk_model.pkl");
  return (
    fs.existsSync(featureColumnsPath) &&
    (fs.existsSync(modelPath) || fs.existsSync(legacyModelPath))
  );
}

function resolveModelDir() {
  if (process.env.BEHAVIOR_AI_MODEL_DIR) {
    return path.resolve(process.env.BEHAVIOR_AI_MODEL_DIR);
  }

  if (hasRequiredModelFiles(preferredModelDir)) {
    return preferredModelDir;
  }

  return legacyModelDir;
}

export const behaviorAiModelDir = resolveModelDir();
export const behaviorAiPythonScriptPath = path.resolve(
  __dirname,
  "../python/behavior-ai/predict_risk.py"
);
