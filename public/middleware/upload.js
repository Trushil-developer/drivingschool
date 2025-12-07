import multer, { memoryStorage } from "multer";
export default multer({ storage: memoryStorage() });
