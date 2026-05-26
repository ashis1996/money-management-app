import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsNumber } from 'class-validator';

export enum NotificationType {
  TRANSACTION = 'TRANSACTION',
  SUBSCRIPTION = 'SUBSCRIPTION',
  BUDGET_ALERT = 'BUDGET_ALERT',
  INSIGHT = 'INSIGHT',
  REMINDER = 'REMINDER',
  SECURITY = 'SECURITY',
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
  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  data?: Record<string, any> | null;

  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;
}

export class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  transactionAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  subscriptionAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  budgetAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  insightAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  securityAlerts?: boolean;

  @IsOptional()
  @IsNumber()
  minAmountForAlert?: number;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() smsEnabled?: boolean;
  @IsOptional() @IsBoolean() transactionAlerts?: boolean;
  @IsOptional() @IsBoolean() subscriptionAlerts?: boolean;
  @IsOptional() @IsBoolean() budgetAlerts?: boolean;
  @IsOptional() @IsBoolean() insightAlerts?: boolean;
  @IsOptional() @IsBoolean() securityAlerts?: boolean;
  @IsOptional() @IsNumber() minAmountForAlert?: number;
}
