// Защита от дублей заявок в пределах 15 секунд
const processedBookings = new Set<string>();

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    const docId = result.documentId || String(result.id);

    if (processedBookings.has(docId)) {
      return;
    }
    processedBookings.add(docId);
    setTimeout(() => processedBookings.delete(docId), 15000);

    try {
      const botToken = (process.env.TELEGRAM_BOT_TOKEN || '8962413216:AAEw9I7MPe3Exci9ShVISxjjC-Csez3-5EU').trim();

      // Загружаем созданную бронь со связанным залом и комплексом
      const booking: any = await strapi.documents('api::booking.booking').findOne({
        documentId: result.documentId,
        populate: ['banya', 'room']
      });

      const chatId = booking?.banya?.telegramChatId?.trim();
      if (!chatId) {
        console.warn('⚠️ [Telegram Hook]: telegramChatId не найден в карточке бани.');
        return;
      }

      const cleanPhone = (booking.clientPhone || '').replace(/\D/g, '');
      const kaspiNumber = booking.kaspiPhone || booking.clientPhone || 'Не указан';
      const depositText = booking.banya?.depositAmount 
        ? `${Number(booking.banya.depositAmount).toLocaleString()} ₸` 
        : 'Без задатка';

      // Санитизация параметров для безопасного режима HTML в Telegram
      const safeRoomName = escapeHtml(booking.room?.name_ru || 'Не указан');
      const safeClientName = escapeHtml(booking.clientName || 'Гость');
      const safeKaspi = escapeHtml(kaspiNumber);

      // Форматирование расшифровки состава заказа
      const rawExtras = booking.extras || '';
      let formattedBreakdown = 'Базовый тариф';

      if (rawExtras) {
        // Разделяем компоненты по разделителю " | " и выводим каждый пункт отдельной строкой
        const parts = rawExtras.split('|').map((p: string) => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          formattedBreakdown = parts.map((p: string) => `• ${escapeHtml(p)}`).join('\n');
        }
      }

      const text = [
        `⚡️ <b>НОВАЯ ЗАЯВКА С САЙТА!</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `🏠 <b>Зал:</b> ${safeRoomName}`,
        `📅 <b>Дата:</b> ${booking.bookingDate}`,
        `⏰ <b>Время:</b> ${booking.bookingTime} (${booking.durationHours} ч)`,
        `👥 <b>Гостей:</b> ${booking.guestsCount} чел`,
        `━━━━━━━━━━━━━━━━━━━`,
        `📋 <b>СОСТАВ ЗАКАЗА:</b>`,
        formattedBreakdown,
        `━━━━━━━━━━━━━━━━━━━`,
        `💳 <b>ОПЛАТА:</b>`,
        `• Номер Kaspi: <code>${safeKaspi}</code>`,
        `• Задаток: <b>${depositText}</b>`,
        `• Итого: <b>${Number(booking.totalPrice || 0).toLocaleString()} ₸</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `👤 <b>Клиент:</b> ${safeClientName} (<code>${booking.clientPhone}</code>)`,
        `⏳ <b>Статус:</b> Ожидает обработки`
      ].join('\n');

      const keyboard = {
        inline_keyboard: [
          [
            { 
              text: '💬 Написать клиенту в WhatsApp', 
              url: `https://wa.me/${cleanPhone}` 
            }
          ],
          [
            {
              text: '✅ Принять (Оплачено)',
              callback_data: `confirm_${docId}`
            },
            {
              text: '❌ Отклонить',
              callback_data: `cancel_${docId}`
            }
          ]
        ]
      };

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: keyboard
        })
      });

      const data: any = await response.json();
      if (!data.ok) {
        console.error('❌ Ошибка Telegram Bot API:', data.description);
      } else {
        console.log(`✅ Заявка доставлена в чат ${chatId} (${booking.banya?.name_ru || ''})`);
      }
    } catch (error) {
      console.error('❌ Ошибка выполнения lifecycles:', error);
    }
  }
};