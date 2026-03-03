import { prisma } from '../../config/database';
import { AppError } from '../../core/AppError';

export class PublicService {

  /* =====================================================
     1️⃣ GET ACTIVE STATES
  ===================================================== */
  static async getActiveStates() {
    return prisma.state.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /* =====================================================
     2️⃣ GET SERVICES BY STATE
  ===================================================== */
  static async getServicesByState(stateId: string) {

    if (!stateId) {
      throw new AppError('State ID is required', 400);
    }

    const stateExists = await prisma.state.findFirst({
      where: {
        id: stateId,
        isActive: true,
      },
    });

    if (!stateExists) {
      throw new AppError('State not found or inactive', 404);
    }

    return prisma.service.findMany({
      where: {
        stateId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        govtFee: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /* =====================================================
     3️⃣ GET REQUIRED DOCUMENTS FOR SERVICE
  ===================================================== */
  static async getServiceDocuments(serviceId: string) {

    if (!serviceId) {
      throw new AppError('Service ID is required', 400);
    }

    const serviceExists = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
      },
    });

    if (!serviceExists) {
      throw new AppError('Service not found or inactive', 404);
    }

    return prisma.serviceRequiredDocument.findMany({
      where: {
        serviceId,
      },
      select: {
        id: true,
        documentName: true,
        isMandatory: true,
      },
      orderBy: {
        documentName: 'asc',
      },
    });
  }

  /* =====================================================
     4️⃣ VALIDATE PINCODE
     GET /api/v1/public/pincode-validate?pincode=xxxxxx
  ===================================================== */
  static async validatePincode(pincode: string) {

    if (!pincode) {
      throw new AppError('Pincode is required', 400);
    }

    // Validate 6-digit numeric format
    const isValidFormat = /^[0-9]{6}$/.test(pincode);

    if (!isValidFormat) {
      throw new AppError('Invalid pincode format', 400);
    }

    const record = await prisma.pincode.findUnique({
      where: {
        code: pincode,
      },
      include: {
        state: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
    });

    if (!record) {
      throw new AppError('Pincode not found', 404);
    }

    if (!record.state.isActive) {
      throw new AppError('State is inactive', 400);
    }

    return {
      pincode: record.code,
      district: record.district,
      state: {
        id: record.state.id,
        name: record.state.name,
        code: record.state.code,
      },
    };
  }
}