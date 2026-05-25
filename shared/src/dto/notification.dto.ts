import { IsString, IsOptional, IsEnum, IsBoolean, IsArray } from 'class-validator';

export enum NotificationType {
  TRANSACTION = 'TRANSACTION',
  REMINDER = 'REMINDER',
  INSIGHT = 'INSIGHT',
  ALERT = 'ALERT',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  data?: Record<string, any>;
}

export class NotificationPreferencesDto {
  @IsBoolean()
  emailEnabled: boolean;

  @IsBoolean()
  pushEnabled: boolean;

  @IsBoolean()
  smsEnabled: boolean;

  @IsArray()
  @IsEnum(NotificationType, { each: true })
  enabledTypes: NotificationType[];
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  enabledTypes?: NotificationType[];
}
