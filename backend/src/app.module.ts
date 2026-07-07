import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AnimalsModule } from './animals/animals.module';
import { NoseModule } from './nose/nose.module';
import { EventsModule } from './events/events.module';
import { ClaimsModule } from './claims/claims.module';
import { UploadModule } from './upload/upload.module';
import { AdminModule } from './admin/admin.module';
import { User } from './users/entities/user.entity';
import { Animal } from './animals/entities/animal.entity';
import { NoseFeature } from './nose/entities/nose-feature.entity';
import { RescueEvent } from './events/entities/event.entity';
import { Claim } from './claims/entities/claim.entity';
import { Comment } from './comments/entities/comment.entity';
import { CommentsModule } from './comments/comments.module';
import { PendingNoseRecord } from './nose/entities/pending-nose-record.entity';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static'),
      serveRoot: '/static',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [User, Animal, NoseFeature, RescueEvent, Claim, Comment, PendingNoseRecord],
        synchronize: true,
        logging: false,
      }),
    }),
    AuthModule,
    UsersModule,
    AnimalsModule,
    NoseModule,
    EventsModule,
    ClaimsModule,
    CommentsModule,
    UploadModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}