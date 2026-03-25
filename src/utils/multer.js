import multer from "multer";

// Configure multer to use memory storage
// Files will be uploaded to Cloudinary instead of stored on disk
export const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB
	},
	fileFilter: (req, file, cb) => {
		// Allow only image files
		if (file.mimetype.startsWith("image/")) {
			cb(null, true);
		} else {
			cb(new Error("Chỉ chấp nhận file hình ảnh"));
		}
	},
});

export const uploadSingle = (fieldName = "file") => upload.single(fieldName);
export const uploadArray = upload.array("files", 10);
export const uploadFields = upload.fields([{ name: "file", maxCount: 1 }]);
