import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username"),
  firstName: text("first_name"),
  photoUrl: text("photo_url"),
  balance: numeric("balance", { precision: 20, scale: 2 }).notNull().default("0"),
  totalDepositedStars: numeric("total_deposited_stars", { precision: 20, scale: 2 })
    .notNull()
    .default("0"),
  totalDepositedTon: numeric("total_deposited_ton", { precision: 20, scale: 4 })
    .notNull()
    .default("0"),
  isDemo: boolean("is_demo").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  xp: numeric("xp", { precision: 20, scale: 2 }).notNull().default("0"),
  dailyStreak: integer("daily_streak").notNull().default(0),
  lastDailyClaim: timestamp("last_daily_claim", { withTimezone: true }),
  tonWalletAddress: text("ton_wallet_address"),
  lastFreeCaseAt: timestamp("last_free_case_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
})

export const gifts = pgTable("gifts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  rarity: text("rarity").notNull().default("common"),
  imageUrl: text("image_url").notNull(),
  value: numeric("value", { precision: 20, scale: 2 }).notNull().default("0"),
  floorTon: numeric("floor_ton", { precision: 20, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  coverUrl: text("cover_url").notNull(),
  price: numeric("price", { precision: 20, scale: 2 }).notNull().default("0"),
  accent: text("accent").notNull().default("cyan"),
  sortOrder: integer("sort_order").notNull().default(0),
  isFree: boolean("is_free").notNull().default(false),
  cooldownHours: integer("cooldown_hours"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const caseItems = pgTable("case_items", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  giftId: integer("gift_id").notNull(),
  weight: numeric("weight", { precision: 12, scale: 4 }).notNull().default("1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const freeCaseProgress = pgTable("free_case_progress", {
  userId: text("user_id").primaryKey(),
  shareCount: integer("share_count").notNull().default(0),
  tradeVisitedAt: timestamp("trade_visited_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  inviterUserId: text("inviter_user_id").notNull(),
  referredUserId: text("referred_user_id").notNull(),
  qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  referredUserUnique: uniqueIndex("referrals_referred_user_unique").on(table.referredUserId),
}))

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  giftId: integer("gift_id").notNull(),
  value: numeric("value", { precision: 20, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("owned"),
  source: text("source").notNull().default("case"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const gameHistory = pgTable("game_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  game: text("game").notNull(),
  bet: numeric("bet", { precision: 20, scale: 2 }).notNull().default("0"),
  result: numeric("result", { precision: 20, scale: 2 }).notNull().default("0"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 20, scale: 4 }).notNull().default("0"),
  credited: numeric("credited", { precision: 20, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"),
  externalId: text("external_id"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const battleRooms = pgTable("battle_rooms", {
  id: serial("id").primaryKey(),
  // Stake PvP rooms are not tied to a case. NULL is the explicit mode marker;
  // legacy case-battle rows may still keep a real cases.id here.
  caseId: integer("case_id"),
  capacity: integer("capacity").notNull(),
  rounds: integer("rounds").notNull(),
  entryCost: numeric("entry_cost", { precision: 20, scale: 2 }).notNull(),
  status: text("status").notNull().default("waiting"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const battleSlots = pgTable("battle_slots", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  slot: integer("slot").notNull(),
  userId: text("user_id"),
  name: text("name").notNull(),
  photoUrl: text("photo_url"),
  isBot: boolean("is_bot").notNull().default(false),
  stake: numeric("stake", { precision: 20, scale: 2 }).notNull().default("0"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
})

export const giveawayChannels = pgTable("giveaway_channels", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  title: text("title").notNull(),
  botStatus: text("bot_status").notNull().default("administrator"),
  canPostMessages: boolean("can_post_messages").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  chatIdUnique: uniqueIndex("giveaway_channels_chat_id_unique").on(table.chatId),
}))

export const giveaways = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  channelId: integer("channel_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  prizeText: text("prize_text").notNull(),
  ticketPrice: numeric("ticket_price", { precision: 20, scale: 2 }).notNull().default("0"),
  winnerCount: integer("winner_count").notNull().default(1),
  maxTicketsPerUser: integer("max_tickets_per_user").notNull().default(1),
  status: text("status").notNull().default("draft"),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  postMessageId: integer("post_message_id"),
  participantCount: integer("participant_count").notNull().default(0),
  ticketCount: integer("ticket_count").notNull().default(0),
  pot: numeric("pot", { precision: 20, scale: 2 }).notNull().default("0"),
  winnerUserIds: jsonb("winner_user_ids"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const giveawayEntries = pgTable("giveaway_entries", {
  id: serial("id").primaryKey(),
  giveawayId: integer("giveaway_id").notNull(),
  userId: text("user_id").notNull(),
  tickets: integer("tickets").notNull().default(1),
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull().default("0"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  giveawayUserUnique: uniqueIndex("giveaway_entries_giveaway_user_unique").on(table.giveawayId, table.userId),
}))
