import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, VersioningType, ExecutionContext, Module } from '@nestjs/common';
import { INestApplication, CanActivate } from '@nestjs/common';
import { AppModule } from '../src/modules/app.module';
import { PrismaService } from '../src/config/prisma.service';
import { RabbitMQService } from '../src/config/rabbitmq.service';
import { RabbitMQModule } from '../src/config/rabbitmq.module';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { LocalAuthGuard } from '../src/common/guards/local-auth.guard';
import { RefreshTokenGuard } from '../src/common/guards/refresh-token.guard';

@Module({
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class MockRabbitMQModule {}

export class TestAuthGuard implements CanActivate {
  constructor(private testUser = { id: 'test-user-1', email: 'test@example.com' }) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = this.testUser;
    return true;
  }
}

export const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  account: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  transaction: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  smsLog: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  notification: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  budget: {
    findMany: jest.fn(),
  },
});

export const createMockRabbitMQ = () => ({
  publishSmsReceived: jest.fn().mockResolvedValue(undefined),
  publishTransactionCreated: jest.fn().mockResolvedValue(undefined),
  publishSubscriptionDetected: jest.fn().mockResolvedValue(undefined),
  publishNotificationRequest: jest.fn().mockResolvedValue(undefined),
});

export interface TestApp {
  app: INestApplication;
  server: any;
  mockPrisma: ReturnType<typeof createMockPrisma>;
  mockRabbitMQ: ReturnType<typeof createMockRabbitMQ>;
  jwtService: JwtService;
  generateToken: (userId: string, email: string) => string;
}

export async function createTestApp(options?: {
  overrideGuards?: boolean;
  testUser?: any;
}): Promise<TestApp> {
  const mockPrisma = createMockPrisma();
  const mockRabbitMQ = createMockRabbitMQ();

  const builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(mockPrisma)
    .overrideModule(RabbitMQModule)
    .useModule(MockRabbitMQModule)
    .overrideProvider(RabbitMQService)
    .useValue(mockRabbitMQ);

  if (options?.overrideGuards !== false) {
    const guard = new TestAuthGuard(options?.testUser);
    builder
      .overrideGuard(JwtAuthGuard)
      .useValue(guard)
      .overrideGuard(LocalAuthGuard)
      .useValue(guard)
      .overrideGuard(RefreshTokenGuard)
      .useValue(guard);
  }

  const moduleRef: TestingModule = await builder.compile();

  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.setGlobalPrefix('api/v1');

  await app.init();

  const jwtService = moduleRef.get(JwtService);

  return {
    app,
    server: app.getHttpServer(),
    mockPrisma,
    mockRabbitMQ,
    jwtService,
    generateToken: (userId: string, email: string) =>
      jwtService.sign({ sub: userId, email }),
  };
}

export const mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  phone: '+1234567890',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
