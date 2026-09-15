import { Args, Float, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaService } from '../../prisma/prisma.service';
import { IncidentsService } from '../../incidents/incidents.service';
import { User, Incident, SystemConfigModel } from '../types/models';
import { UserRole, IncidentStatus } from '@prisma/client';

@Resolver()
export class AdminResolver {
  constructor(
    private prisma: PrismaService,
    private incidentsService: IncidentsService,
  ) {}

  @Query(() => [User])
  async users(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      include: {
        incidents: {
          include: { locationLogs: true },
          orderBy: { startedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      incidents: u.incidents.map((inc) => ({
        ...inc,
        startedAt: inc.startedAt.toISOString(),
        resolvedAt: inc.resolvedAt?.toISOString(),
        locationLogs: inc.locationLogs.map((log) => ({
          ...log,
          loggedAt: log.loggedAt.toISOString(),
        })),
      })),
    }));
  }

  @Query(() => User, { nullable: true })
  async user(@Args('id', { type: () => ID }) id: string): Promise<User | null> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        incidents: {
          include: { locationLogs: true },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!u) return null;

    return {
      ...u,
      createdAt: u.createdAt.toISOString(),
      incidents: u.incidents.map((inc) => ({
        ...inc,
        startedAt: inc.startedAt.toISOString(),
        resolvedAt: inc.resolvedAt?.toISOString(),
        locationLogs: inc.locationLogs.map((log) => ({
          ...log,
          loggedAt: log.loggedAt.toISOString(),
        })),
      })),
    };
  }

  @Query(() => [Incident])
  async incidents(
    @Args('status', { type: () => IncidentStatus, nullable: true }) status?: IncidentStatus,
  ): Promise<Incident[]> {
    const incs = await this.incidentsService.getAllIncidents(status);
    return incs.map((inc) => ({
      ...inc,
      startedAt: inc.startedAt.toISOString(),
      resolvedAt: inc.resolvedAt?.toISOString(),
      locationLogs: inc.locationLogs.map((log) => ({
        ...log,
        loggedAt: log.loggedAt.toISOString(),
      })),
    }));
  }

  @Query(() => Incident, { nullable: true })
  async incident(@Args('id', { type: () => ID }) id: string): Promise<Incident | null> {
    const inc = await this.incidentsService.getIncidentById(id);
    if (!inc) return null;

    return {
      ...inc,
      startedAt: inc.startedAt.toISOString(),
      resolvedAt: inc.resolvedAt?.toISOString(),
      locationLogs: inc.locationLogs.map((log) => ({
        ...log,
        loggedAt: log.loggedAt.toISOString(),
      })),
    };
  }

  @Query(() => Int)
  async activeIncidentsCount(): Promise<number> {
    return this.incidentsService.getActiveCount();
  }

  @Mutation(() => User)
  async updateUserRole(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('role', { type: () => UserRole }) role: UserRole,
  ): Promise<User> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        incidents: {
          include: { locationLogs: true },
        },
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      incidents: updated.incidents.map((inc) => ({
        ...inc,
        startedAt: inc.startedAt.toISOString(),
        resolvedAt: inc.resolvedAt?.toISOString(),
        locationLogs: inc.locationLogs.map((log) => ({
          ...log,
          loggedAt: log.loggedAt.toISOString(),
        })),
      })),
    };
  }

  @Mutation(() => Incident)
  async resolveIncident(
    @Args('incidentId', { type: () => ID }) incidentId: string,
    @Args('status', { type: () => IncidentStatus }) status: IncidentStatus,
  ): Promise<Incident> {
    const inc = await this.incidentsService.updateStatus(incidentId, status);
    return {
      ...inc,
      startedAt: inc.startedAt.toISOString(),
      resolvedAt: inc.resolvedAt?.toISOString(),
      locationLogs: inc.locationLogs.map((log) => ({
        ...log,
        loggedAt: log.loggedAt.toISOString(),
      })),
    };
  }

  // Global Edge System Config State
  private currentConfig = {
    yamnetScreamThreshold: 0.60,
    openWakeWordThreshold: 0.70,
    snatchThresholdG: 3.2,
    batteryCriticalThreshold: 0.05,
    deadmanTimeoutMins: 15,
    updatedAt: new Date().toISOString(),
  };

  @Query(() => SystemConfigModel)
  async systemConfig(): Promise<SystemConfigModel> {
    return this.currentConfig;
  }

  @Mutation(() => SystemConfigModel)
  async updateSystemConfig(
    @Args('yamnetScreamThreshold', { type: () => Float, nullable: true }) yamnetScreamThreshold?: number,
    @Args('openWakeWordThreshold', { type: () => Float, nullable: true }) openWakeWordThreshold?: number,
    @Args('snatchThresholdG', { type: () => Float, nullable: true }) snatchThresholdG?: number,
    @Args('batteryCriticalThreshold', { type: () => Float, nullable: true }) batteryCriticalThreshold?: number,
    @Args('deadmanTimeoutMins', { type: () => Int, nullable: true }) deadmanTimeoutMins?: number,
  ): Promise<SystemConfigModel> {
    if (yamnetScreamThreshold !== undefined) this.currentConfig.yamnetScreamThreshold = yamnetScreamThreshold;
    if (openWakeWordThreshold !== undefined) this.currentConfig.openWakeWordThreshold = openWakeWordThreshold;
    if (snatchThresholdG !== undefined) this.currentConfig.snatchThresholdG = snatchThresholdG;
    if (batteryCriticalThreshold !== undefined) this.currentConfig.batteryCriticalThreshold = batteryCriticalThreshold;
    if (deadmanTimeoutMins !== undefined) this.currentConfig.deadmanTimeoutMins = deadmanTimeoutMins;
    this.currentConfig.updatedAt = new Date().toISOString();

    return this.currentConfig;
  }
}
