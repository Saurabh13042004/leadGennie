import { z } from "zod";
import { processLinkedinSends } from "@/lib/campaigns/linkedin-queue";
import { registerJobHandler } from "@/lib/jobs/registry";
import { registerScheduler } from "@/lib/jobs/schedulers";
import { campaignSendHandler } from "./handler";
import { enqueueDueSends } from "./scheduler";

// Importing this module registers the email-sending job and its scheduler (see lib/jobs/handlers.ts).
registerJobHandler("campaign_send", campaignSendHandler, { payload: z.object({ campaignSendId: z.number().int().positive() }) });
registerScheduler("campaign_sends", (o) => enqueueDueSends(o));
// LinkedIn DMs are only moved to the extension's queue here — never sent by the server (see linkedin-queue.ts).
registerScheduler("linkedin_queue", (o) => processLinkedinSends(o.workspaceId));
