import express from "express";
import { paymentController } from "../controllers/payment.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

// Paystack webhook (no auth needed, secured by secret verification)
router.post("/webhook/paystack", paymentController.handleWebhook);

// Payment routes (authenticated)
router.post(
  "/initiate",
  authMiddleware.protect,
  paymentController.initializePayment
);
router.get(
  "/verify/:reference",
  authMiddleware.protect,
  paymentController.verifyPayment
);
router.get(
  "/history",
  authMiddleware.protect,
  paymentController.getPaymentHistory
);

// Payment information routes
router.get("/:paymentId", authMiddleware.protect, paymentController.getPaymentDetails);

export default router;
