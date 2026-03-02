import { Router } from "express";
import jwt from "jsonwebtoken";
import prisma from "../core/prisma";

const router = Router();

/* =====================================================
   SEND OTP (DEV MODE)
===================================================== */
router.post("/send", async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Expiry 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Delete previous OTPs for same mobile
    await prisma.otp.deleteMany({
      where: { mobile },
    });

    // Store OTP
    await prisma.otp.create({
      data: {
        mobile,
        code: otp,
        expiresAt,
      },
    });

    // DEV: print OTP in console
    console.log(`🔥 DEV OTP for ${mobile} is ${otp}`);

    return res.json({
      success: true,
      message: "OTP generated (dev mode)",
    });

  } catch (error) {
    console.error("OTP SEND ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate OTP",
    });
  }
});

/* =====================================================
   VERIFY OTP
===================================================== */
router.post("/verify", async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile and OTP required",
      });
    }

    const record = await prisma.otp.findFirst({
      where: {
        mobile,
        code: otp,
      },
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // Delete used OTP
    await prisma.otp.deleteMany({
      where: { mobile },
    });

    /* =====================================================
       FIND OR CREATE USER
    ===================================================== */
    let user = await prisma.user.findUnique({
      where: { phoneNumber: mobile },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber: mobile,
          role: "CUSTOMER",
        },
      });
    }

    /* =====================================================
       GENERATE JWT
    ===================================================== */
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      data: {
        accessToken: token,
        user: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    });

  } catch (error) {
    console.error("OTP VERIFY ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
});

export default router;