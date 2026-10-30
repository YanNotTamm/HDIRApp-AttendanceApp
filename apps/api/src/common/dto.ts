import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}

export class CreateUserDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() employee_code!: string;
  @IsInt() @Min(1) role_id!: number;
  @IsOptional() @IsInt() department_id?: number;
  @IsOptional() @IsInt() office_id?: number;
  @IsOptional() @IsString() phone?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  // Only an admin may change role_id; enforced in UsersService by caller role.
  @IsOptional() @IsInt() role_id?: number;
  @IsOptional() @IsString() employee_code?: string;
  @IsOptional() @IsInt() department_id?: number;
  @IsOptional() @IsInt() office_id?: number;
  @IsOptional() @IsString() phone?: string;
}

export class OfficeDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() address?: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsInt() @Min(1) radius_meters?: number;
}

export class UpdateOfficeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsInt() @Min(1) radius_meters?: number;
}

export class FacePhotoDto {
  // Photo for enroll/verify. The descriptor is extracted on the server;
  // this DTO deliberately has NO descriptor field (see face.service.ts).
  @IsString() @IsNotEmpty() @MaxLength(3_000_000) selfiePhoto!: string;
}

export class CheckInDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsString() reason?: string;
  // Data-URI or raw base64, max ~2.8M chars (~2 MB decoded); enforced in photo.ts.
  @IsOptional() @IsString() @MaxLength(3_000_000) selfiePhoto?: string;
}

export class CheckOutDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() @MaxLength(3_000_000) selfiePhoto?: string;
}

export class CreateLeaveTypeDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsInt() @Min(0) default_annual_quota!: number;
  @IsOptional() carry_over_allowed?: boolean;
}

export class CreateLeaveDto {
  @IsInt() @Min(1) leave_type_id!: number;
  @IsString() @IsNotEmpty() start_date!: string;
  @IsString() @IsNotEmpty() end_date!: string;
  @IsString() @IsNotEmpty() reason!: string;
}

export class UpdateQuotaDto {
  @IsInt() @Min(0) quota_days!: number;
}

export class DeviceBindDto {
  @IsString() @IsNotEmpty() device_uid!: string;
  @IsOptional() @IsString() device_info?: string;
}
