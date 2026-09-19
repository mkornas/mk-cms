import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Form } from './entities/form.entity';
import { FormSubmission } from './entities/form-submission.entity';
import { FormsService } from './forms.service';
import { FormsSubscriber } from './forms.subscriber';
import { FormsController } from './forms.controller';

/**
 * First-party forms module. Public schema + submit endpoints live on the REST
 * controller; admin CRUD + submissions are on the admin GraphQL surface.
 * Submissions are validated by the shared field-type registry, and notifications
 * ride the mail queue via {@link FormsSubscriber}. The mail queue comes from the
 * global MailModule; content/hook services are global too.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Form, FormSubmission])],
  controllers: [FormsController],
  providers: [FormsService, FormsSubscriber],
  exports: [FormsService],
})
export class FormsModule {}
