import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Res,
  InternalServerErrorException,
  Req,
  Get,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { EmailService } from 'src/common/email/email.service';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { openApiResponse } from 'src/common/decorator/openApi.decorator';
import { LoginDto, ResetPasswordDto, SendMailDto } from './dto';
import { IRequest } from 'src/common/interfaces';
import { RefreshStrategy } from 'src/common/strategy/refresh.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  @Post('login')
  @ApiBody({ type: LoginDto })
  @openApiResponse(
    {
      status: HttpStatus.OK,
      description: 'accessToken & refreshToken has been returned!',
    },
    { status: HttpStatus.UNAUTHORIZED, description: 'unothorized!' },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'something went wrong!',
    },
  )
  public async login(@Res() res: Response, @Body() body: LoginDto) {
    try {
      const { mail, password } = body;
      const user = await this.authService.getUserByMail(mail);
      const verifPassword = await this.authService.decodePassword(
        user,
        password,
      );
      if (!user || !verifPassword) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'unothorized',
        });
      }
      const { accessToken, refreshToken } =
        await this.authService.generateToken(user);
      return res.status(HttpStatus.OK).send({
        statusCode: HttpStatus.OK,
        user: user,
        accessToken: accessToken,
        refreshToken: refreshToken,
      });
    } catch (err) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: err,
      });
    }
  }

  @UseGuards(AuthGuard('refresh'), RefreshStrategy)
  @Get('refresh')
  @openApiResponse(
    { status: HttpStatus.OK, description: 'Token refreshed' },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'something went wrong!',
    },
  )
  async refreshToken(@Req() req: IRequest, @Res() res: Response) {
    let user = req.user;
    try {
      const { accessToken, refreshToken } =
        await this.authService.generateToken(user);
      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error,
      });
    }
  }

  @Post('resetpassword')
  @openApiResponse(
    {
      status: HttpStatus.OK,
      description: 'Reset password mail has been sent successfuly!',
    },
    { status: HttpStatus.UNAUTHORIZED, description: 'user unothorized!' },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'something went wrong!',
    },
  )
  public async sendEmailReset(@Res() res: Response, @Body() body: SendMailDto) {
    const { mail } = body;
    try {
      const user = await this.authService.getUserByMail(mail);
      if (!user) {
        return res.status(HttpStatus.UNAUTHORIZED).send({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'user unothorized!',
        });
      }
      const resetPasswordToken =
        await this.authService.generateResetPasswordToken(user);
      const context = {
        url: process.env.FRONT_LINK + '/resetpassword/' + resetPasswordToken,
      };
      this.emailService.sendEmail({
        to: user.email,
        subject: 'reset password',
        template: 'resetPasswordTemplate',
        context: context,
      });
      return res.status(HttpStatus.OK).send({
        statusCode: HttpStatus.OK,
        message: 'reset mail has been sent successfuly!',
      });
    } catch (err) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errors: err,
        message: 'something went wrong',
      });
    }
  }
  @Post('resetpassword/:token')
  @ApiBody({ type: ResetPasswordDto })
  @openApiResponse(
    { status: HttpStatus.OK, description: 'password changed successfuly !' },
    { status: HttpStatus.BAD_REQUEST, description: 'token is invalid !' },
    { status: HttpStatus.BAD_REQUEST, description: 'passwords not matching !' },
    {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'something went wrong!',
    },
  )
  async resetPassword(
    @Res() res: Response,
    @Body() body: ResetPasswordDto,
    @Param('token') token: string,
  ) {
    const { password, confirmPassword } = body;
    try {
      if (password === confirmPassword) {
        await this.authService.ResetPasswordToken(token, confirmPassword);
        return res.status(HttpStatus.OK).send({
          statusCode: HttpStatus.OK,
          message: 'password changed successfuly!',
        });
      } else {
        return res.status(HttpStatus.BAD_REQUEST).send({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'passwords not matching !',
        });
      }
    } catch (err) {
      throw new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        errors: err,
        message: 'something went wrong',
      });
    }
  }
}
