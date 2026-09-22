import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { HttpLoggingInterceptor } from "./common/interceptors/http-logging.interceptor";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import * as path from "path";
import * as fs from "fs";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const fastifyAdapter = new FastifyAdapter({
    logger: false,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );

  // Ensure uploads/evidence directory exists
  const uploadsDir = path.join(process.cwd(), "uploads", "evidence");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Register multipart support for audio evidence uploads
  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MB max
    },
  });

  // Register static file serving for uploaded evidence with proper audio streaming headers
  await app.register(fastifyStatic as any, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
    decorateReply: false,
    setHeaders: (res: any, pathName: string) => {
      const setH = (key: string, val: string) => {
        if (typeof res?.header === "function") {
          res.header(key, val);
        } else if (typeof res?.setHeader === "function") {
          res.setHeader(key, val);
        } else if (res?.raw && typeof res.raw.setHeader === "function") {
          res.raw.setHeader(key, val);
        }
      };

      setH("Access-Control-Allow-Origin", "*");
      setH("Accept-Ranges", "bytes");
      if (pathName.endsWith(".m4a")) {
        setH("Content-Type", "audio/mp4");
      } else if (pathName.endsWith(".wav")) {
        setH("Content-Type", "audio/wav");
      } else if (pathName.endsWith(".webm")) {
        setH("Content-Type", "audio/webm");
      }
    },
  });

  // Enable CORS
  app.enableCors({
    origin: "*",
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Enable global HTTP request/response logging
  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, "0.0.0.0");

  logger.log(
    `Project Guardian Fastify NestJS Backend is running on: http://localhost:${port}`,
  );
  logger.log(
    `GraphQL Apollo/Mercurius Playground available at: http://localhost:${port}/graphql`,
  );
  logger.log(`WebSocket Real-Time Gateway initialized on port: ${port}`);
}

bootstrap().catch((err) => {
  console.error("Fatal error starting Guardian NestJS Backend:", err);
});
