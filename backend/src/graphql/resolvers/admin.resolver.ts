import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaService } from '../../prisma/prisma.service';
import { IncidentsService } from '../../incidents/incidents.service';
import { User, Incident } from '../types/models';
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
}
