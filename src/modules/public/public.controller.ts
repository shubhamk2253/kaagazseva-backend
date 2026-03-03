import { Request, Response } from 'express';
import { prisma } from '../../config/database';

export class PublicController {

  static async getStates(req: Request, res: Response) {
    const states = await prisma.state.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, data: states });
  }

  static async getServicesByState(req: Request, res: Response) {
    const { stateId } = req.query;

    if (!stateId) {
      return res.status(400).json({
        success: false,
        message: 'stateId is required',
      });
    }

    const services = await prisma.service.findMany({
      where: {
        stateId: String(stateId),
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ success: true, data: services });
  }

  static async getServiceDocuments(req: Request, res: Response) {
    const { id } = req.params;

    const documents = await prisma.serviceRequiredDocument.findMany({
      where: { serviceId: id },
      orderBy: { documentName: 'asc' },
    });

    return res.json({ success: true, data: documents });
  }
}