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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.otp.deleteMany({
      where: { mobile },
    });

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
       GENERATE TOKEN USING JwtService (CRITICAL FIX)
    ===================================================== */

    const accessToken = JwtService.signAccessToken({
      userId: user.id,   // ✅ correct key
      role: user.role,   // ✅ enum safe
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