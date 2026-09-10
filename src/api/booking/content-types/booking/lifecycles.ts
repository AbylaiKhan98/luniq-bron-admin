// Защита от дублей в пределах сессии
const processedBookings = new Set<string>();

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
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

      // Подтягиваем данные брони
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

      const safeRoomName = escapeHtml(booking.room?.name_ru || 'Не указан');
      const safeClientName = escapeHtml(booking.clientName || 'Гость');
      const safeExtras = escapeHtml(booking.extras || 'Нет');
      const safeKaspi = escapeHtml(kaspiNumber);

      const text = [
        `⚡️ <b>НОВАЯ ЗАЯВКА С САЙТА!</b>`,
        `━━━━━━━━━━━━━━━━━━━`,
        `🏠 <b>Зал:</b> ${safeRoomName}`,
        `📅 <b>Дата:</b> ${booking.bookingDate}`,
        `⏰ <b>Время:</b> ${booking.bookingTime} (${booking.durationHours} ч)`,
        `👥 <b>Гостей:</b> ${booking.guestsCount}`,
        `🌿 <b>Дополнительно:</b> ${safeExtras}`,
        `━━━━━━━━━━━━━━━━━━━`,
        `💳 <b>ДЕТАЛИ ОПЛАТЫ:</b>`,
        `• Номер Kaspi: <code>${safeKaspi}</code>`,
        `• Условие: <b>${depositText}</b>`,
        `• Общая сумма: <b>${Number(booking.totalPrice || 0).toLocaleString()} ₸</b>`,
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