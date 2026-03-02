import { Router } from "express";
import prisma from "../core/prisma";
import { JwtService } from "../infrastructure/jwt/jwt.service";

const router = Router();

/* =====================================================
   SEND OTP (DEV MODE - DATABASE STORED)
===================================================== */
router.post("/send", async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || mobile.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Valid mobile number required",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Expiry 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Remove old OTPs
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

    console.log(`🔥 DEV OTP for ${mobile} is ${otp}`);

    return res.json({
      success: true,
      message: "OTP generated successfully (dev mode)",
    });
  } catch (error: any) {
    console.error("OTP SEND ERROR:", error.message);

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

    // Find OTP record
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

    // Delete OTP after verification
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
       GENERATE ACCESS TOKEN
       Must match TokenPayload interface
    ===================================================== */

    const accessToken = JwtService.signAccessToken({
      userId: user.id,
      role: user.role,
      phoneNumber: user.phoneNumber, // 🔥 REQUIRED
    });

    return res.json({
      success: true,
      data: {
        accessToken,
        user,
      },
    });

  } catch (error: any) {
    console.error("OTP VERIFY ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
});

export default router;