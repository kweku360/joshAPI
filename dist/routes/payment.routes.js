"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payment_controller_1 = require("../controllers/payment.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Paystack webhook (no auth needed, secured by secret verification)
router.post("/webhook/paystack", payment_controller_1.paymentController.handleWebhook);
// Payment routes (authenticated)
router.post("/initiate", authMiddleware_1.authMiddleware.protect, payment_controller_1.paymentController.initializePayment);
router.get("/verify/:reference", authMiddleware_1.authMiddleware.protect, payment_controller_1.paymentController.verifyPayment);
router.get("/history", authMiddleware_1.authMiddleware.protect, payment_controller_1.paymentController.getPaymentHistory);
// Payment information routes
router.get("/:paymentId", authMiddleware_1.authMiddleware.protect, payment_controller_1.paymentController.getPaymentDetails);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map