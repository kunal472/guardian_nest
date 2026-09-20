import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { SosGateway } from '../gateway/sos.gateway';
import { IncidentStatus, TriggerType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

describe('IncidentsController', () => {
  let controller: IncidentsController;
  let incidentsService: {
    createIncident: ReturnType<typeof vi.fn>;
    recordLocationUpdate: ReturnType<typeof vi.fn>;
    attachAudioEvidence: ReturnType<typeof vi.fn>;
    getAllIncidents: ReturnType<typeof vi.fn>;
    getActiveCount: ReturnType<typeof vi.fn>;
    getIncidentById: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    notifyEmergencyContacts: ReturnType<typeof vi.fn>;
    generateAudioPresignedUrl: ReturnType<typeof vi.fn>;
  };
  let sosGateway: {
    server: {
      emit: ReturnType<typeof vi.fn>;
      to: ReturnType<typeof vi.fn>;
    };
    broadcastStatusChange: ReturnType<typeof vi.fn>;
  };

  const sampleUuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  beforeEach(async () => {
    incidentsService = {
      createIncident: vi.fn(),
      recordLocationUpdate: vi.fn(),
      attachAudioEvidence: vi.fn(),
      getAllIncidents: vi.fn(),
      getActiveCount: vi.fn(),
      getIncidentById: vi.fn(),
      updateStatus: vi.fn(),
      notifyEmergencyContacts: vi.fn(),
      generateAudioPresignedUrl: vi.fn(),
    };

    const toMock = { emit: vi.fn() };
    sosGateway = {
      server: {
        emit: vi.fn(),
        to: vi.fn().mockReturnValue(toMock),
      },
      broadcastStatusChange: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncidentsController],
      providers: [
        { provide: IncidentsService, useValue: incidentsService },
        { provide: SosGateway, useValue: sosGateway },
      ],
    }).compile();

    controller = module.get<IncidentsController>(IncidentsController);
  });

  afterEach(() => {
    // Clean up temporary uploads folder created during evidence upload tests
    const uploadsDir = path.join(process.cwd(), 'uploads', 'evidence');
    if (fs.existsSync(uploadsDir)) {
      try {
        fs.rmSync(uploadsDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('createIncident should delegate to incidentsService', async () => {
    const req = { user: { id: 'u-123' } };
    const dto = { lat: 40.7128, lng: -74.006, triggerType: TriggerType.MANUAL_SOS };
    incidentsService.createIncident.mockResolvedValue({ id: sampleUuid });

    const result = await controller.createIncident(req, dto);
    expect(incidentsService.createIncident).toHaveBeenCalledWith('u-123', dto);
    expect(result).toEqual({ id: sampleUuid });
  });

  it('recordLocation should delegate to incidentsService', async () => {
    incidentsService.recordLocationUpdate.mockResolvedValue({ success: true });

    const result = await controller.recordLocation(sampleUuid, { lat: 40.71, lng: -74.0, batteryLevel: 90 });
    expect(incidentsService.recordLocationUpdate).toHaveBeenCalledWith(sampleUuid, 40.71, -74.0, 90);
    expect(result).toEqual({ success: true });
  });

  describe('uploadAudioEvidence', () => {
    it('should handle multipart stream file upload', async () => {
      const mockFileStream = {
        file: (async function* () {
          yield Buffer.from('audio_chunk_data');
        })(),
      };
      const req = {
        isMultipart: () => true,
        file: vi.fn().mockResolvedValue(mockFileStream),
      };
      incidentsService.attachAudioEvidence.mockResolvedValue({ id: sampleUuid, evidenceAudioUrl: 'url' });

      const result = await controller.uploadAudioEvidence(sampleUuid, req, {});
      expect(result.success).toBe(true);
      expect(result.incidentId).toBe(sampleUuid);
      expect(incidentsService.attachAudioEvidence).toHaveBeenCalled();
      expect(sosGateway.server.emit).toHaveBeenCalledWith('incident:updated', expect.any(Object));
    });

    it('should handle base64 audio payload', async () => {
      const req = { isMultipart: () => false };
      const body = { audioBase64: 'data:audio/m4a;base64,QUJDREVGRw==' };
      incidentsService.attachAudioEvidence.mockResolvedValue({ id: sampleUuid });

      const result = await controller.uploadAudioEvidence(sampleUuid, req, body);
      expect(result.success).toBe(true);
      expect(result.evidenceAudioUrl).toContain('.m4a');
    });

    it('should handle direct evidenceAudioUrl in body', async () => {
      const req = { isMultipart: () => false };
      const body = { evidenceAudioUrl: 'https://s3.amazonaws.com/evidence/audio.m4a' };
      incidentsService.attachAudioEvidence.mockResolvedValue({ id: sampleUuid });

      const result = await controller.uploadAudioEvidence(sampleUuid, req, body);
      expect(result.success).toBe(true);
      expect(result.evidenceAudioUrl).toBe('https://s3.amazonaws.com/evidence/audio.m4a');
    });

    it('should fallback to default vault payload if no audio data is supplied', async () => {
      const req = { isMultipart: () => false };
      incidentsService.attachAudioEvidence.mockResolvedValue({ id: sampleUuid });

      const result = await controller.uploadAudioEvidence(sampleUuid, req, {});
      expect(result.success).toBe(true);
      expect(result.evidenceAudioUrl).toContain('/uploads/evidence/');
    });
  });

  it('getAllIncidents should delegate to service', async () => {
    incidentsService.getAllIncidents.mockResolvedValue([{ id: sampleUuid }]);
    const result = await controller.getAllIncidents(IncidentStatus.ACTIVE);
    expect(incidentsService.getAllIncidents).toHaveBeenCalledWith(IncidentStatus.ACTIVE);
    expect(result).toEqual([{ id: sampleUuid }]);
  });

  it('getActiveCount should delegate to service', async () => {
    incidentsService.getActiveCount.mockResolvedValue(5);
    const result = await controller.getActiveCount();
    expect(result).toEqual({ activeIncidentsCount: 5 });
  });

  it('getIncidentById should delegate to service', async () => {
    incidentsService.getIncidentById.mockResolvedValue({ id: sampleUuid });
    const result = await controller.getIncidentById(sampleUuid);
    expect(result).toEqual({ id: sampleUuid });
  });

  it('updateStatus should delegate to service and broadcast status change', async () => {
    const req = { user: { id: 'u-responder' } };
    const updated = { id: sampleUuid, status: IncidentStatus.RESOLVED };
    incidentsService.updateStatus.mockResolvedValue(updated);

    const result = await controller.updateStatus(req, sampleUuid, IncidentStatus.RESOLVED);
    expect(incidentsService.updateStatus).toHaveBeenCalledWith(sampleUuid, IncidentStatus.RESOLVED, 'u-responder');
    expect(sosGateway.broadcastStatusChange).toHaveBeenCalledWith(
      sampleUuid,
      IncidentStatus.RESOLVED,
      'u-responder',
      updated,
    );
    expect(result).toEqual(updated);
  });

  it('notifyContacts should delegate to service', async () => {
    incidentsService.notifyEmergencyContacts.mockResolvedValue({ dispatchedCount: 2 });
    const result = await controller.notifyContacts(sampleUuid);
    expect(result).toEqual({ dispatchedCount: 2 });
  });

  it('getPresignedAudioUrl should delegate to service', async () => {
    incidentsService.generateAudioPresignedUrl.mockReturnValue('/uploads/evidence/audio.m4a');
    const result = await controller.getPresignedAudioUrl(sampleUuid);
    expect(result).toEqual({
      presignedUrl: '/uploads/evidence/audio.m4a',
      expiresInSeconds: 300,
    });
  });
});
