import axios from "axios";

/* =====================================================
   ENV VALIDATION
===================================================== */

const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;

if (!AUTH_KEY) {
  throw new Error("MSG91_AUTH_KEY is missing in environment variables");
}

if (!TEMPLATE_ID) {
  throw new Error("MSG91_TEMPLATE_ID is missing in environment variables");
}

/* =====================================================
   AXIOS INSTANCE (Cleaner + Production Safe)
===================================================== */

const msg91Client = axios.create({
  baseURL: "https://control.msg91.com/api/v5",
  headers: {
    authkey: AUTH_KEY,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/* =====================================================
   SEND OTP
===================================================== */

export const sendOTP = async (mobile: string) => {
  try {
    const response = await msg91Client.post("/otp", {
      mobile: `91${mobile}`,
      template_id: TEMPLATE_ID,
    });

    return response.data;

  } catch (error: any) {
    console.error("MSG91 SEND ERROR:", error?.response?.data || error.message);
    throw new Error("OTP sending failed");
  }
};

/* =====================================================
   VERIFY OTP
===================================================== */

export const verifyOTP = async (mobile: string, otp: string) => {
  try {
    const response = await msg91Client.get(
      `/otp/verify?mobile=91${mobile}&otp=${otp}`
    );

    return response.data;

  } catch (error: any) {
    console.error("MSG91 VERIFY ERROR:", error?.response?.data || error.message);
    throw new Error("OTP verification failed");
  }
};