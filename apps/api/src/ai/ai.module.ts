import { Module } from '@nestjs/common';
import { AIService, GeminiProvider, GrokProvider, GroqProvider, OpenRouterProvider } from './ai.service';
import { AIController } from './ai.controller';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [GroupsModule],
  controllers: [AIController],
  providers: [AIService, GeminiProvider, GrokProvider, GroqProvider, OpenRouterProvider],
  exports: [AIService],
})
export class AIModule {}
