import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Option } from './entities/option.entity';
import { OptionsService } from './options.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Option])],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
