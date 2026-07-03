import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  validateParsedParticipants,
  parseExpenseRequestSchema,
  canonicalizeParsedExpenseNames,
  validateParsedSplitTotals,
  buildExpenseFromLineItems,
} from '@split/shared';
import { AIService } from './ai.service';
import { GroupsService } from '../groups/groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AIController {
  constructor(
    private ai: AIService,
    private groups: GroupsService,
  ) {}

  @Post('parse-expense')
  @Throttle({ default: { limit: 30, ttl: 3600000 } })
  @ApiOperation({ summary: 'Parse natural language expense input' })
  async parseExpense(
    @CurrentUser() user: { id: string; name: string; defaultCurrency: string },
    @Body() body: unknown,
  ) {
    let data;
    try {
      data = parseExpenseRequestSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new BadRequestException(err.issues[0]?.message ?? 'Invalid parse-expense request');
      }
      throw err;
    }

    const members = data.groupId
      ? await this.groups.getMemberList(data.groupId, user.id)
      : await this.groups.getKnownMembersForUser(user.id);

    if (members.length === 0) {
      throw new BadRequestException('Join or create a group before parsing expenses with AI');
    }

    const defaultCurrency = data.groupId
      ? await this.groups.getGroupCurrency(data.groupId, user.id)
      : user.defaultCurrency;

    const memberNames = members.map((m) => m.name);
    const rawParsed = await this.ai.parseExpense(data.text, {
      memberNames,
      defaultCurrency,
      speakerName: user.name,
    });

    // When the AI returns structured line items, compute amount/splits deterministically
    // (the AI never does arithmetic), so multi-item splits are always correct.
    const computed = buildExpenseFromLineItems(rawParsed.line_items, {
      memberNames,
      speakerName: user.name,
    });
    const merged = computed ? { ...rawParsed, ...computed } : rawParsed;

    const canonical = canonicalizeParsedExpenseNames(merged, members, {
      id: user.id,
      name: user.name,
    });
    const { line_items: _lineItems, ...parsedBase } = merged;
    const parsed = { ...parsedBase, ...canonical };

    const validation = validateParsedParticipants(
      { participants: parsed.participants, payer: parsed.payer },
      members,
      { id: user.id, name: user.name },
    );

    if (validation.unknownPayer) {
      throw new BadRequestException(
        `Unknown payer "${validation.unknownPayer}". Only group members can be included: ${members.map((m) => m.name).join(', ')}`,
      );
    }

    if (validation.unknownParticipants.length > 0) {
      throw new BadRequestException(
        `Unknown participants: ${validation.unknownParticipants.join(', ')}. Add them via Edit Group first. Known members: ${members.map((m) => m.name).join(', ')}`,
      );
    }

    const splitError = validateParsedSplitTotals(parsed);
    if (splitError) {
      throw new BadRequestException(splitError);
    }

    return parsed;
  }
}
