import type { Core } from '@strapi/strapi';

declare global {
  var __telegramPollingActive: boolean | undefined;
}

export default {
  register() {},

  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const botToken = (process.env.TELEGRAM_BOT_TOKEN || '8962413216:AAEw9I7MPe3Exci9ShVISxjjC-Csez3-5EU').trim();

    if (!botToken || global.__telegramPollingActive) return;
    global.__telegramPollingActive = true;

    let offset = 0;

    async function pollTelegramUpdates() {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=20`, {
          signal: AbortSignal.timeout(25000)
        });
        const data: any = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            if (update.callback_query) {
              await handleCallbackQuery(update.callback_query);
            }
          }
          setTimeout(pollTelegramUpdates, 1000);
        } else {
          setTimeout(pollTelegramUpdates, 5000);
        }
      } catch (e) {
        // При любой ошибке сети спим 15 секунд и не вешаем систему
        setTimeout(pollTelegramUpdates, 15000);
      }
    }

    async function handleCallbackQuery(callbackQuery: any) {
      const { id, data, message, from } = callbackQuery;
      if (!data || (!data.startsWith('confirm_') && !data.startsWith('cancel_'))) return;

      const [action, bookingDocId] = data.split('_');
      const adminName = from.first_name || 'Администратор';
      const isConfirmed = action === 'confirm';

      try {
        const booking: any = await strapi.documents('api::booking.booking').findOne({
          documentId: bookingDocId,
          populate: ['room', 'banya']
        });

        const newStatus = isConfirmed ? 'confirmed' : 'cancelled';
        const clientPhoneClean = (booking?.clientPhone || '').replace(/\D/g, '');
        const clientName = booking?.clientName || 'Гость';
        const roomName = booking?.room?.name_ru || 'Зал';
        const bTime = booking?.bookingTime || '';
        const bDate = booking?.bookingDate || '';

        let waMessage = isConfirmed
          ? `Здравствуйте, ${clientName}! Ваша бронь на ${bDate} в ${bTime} (${roomName}) подтверждена. Ждем вас!`
          : `Здравствуйте, ${clientName}! К сожалению, зал на ${bDate} в ${bTime} (${roomName}) уже занят.`;

        const waDirectUrl = `https://wa.me/${clientPhoneClean}?text=${encodeURIComponent(waMessage)}`;

        await strapi.documents('api::booking.booking').update({
          documentId: bookingDocId,
          data: { bookingStatus: newStatus }
        });

        const statusTitle = isConfirmed 
          ? `✅ <b>БРОНЬ ПОДТВЕРЖДЕНА И ОПЛАЧЕНА</b>\n👤 Принял(а): ${adminName}` 
          : `❌ <b>ЗАЯВКА ОТКЛОНЕНА</b>\n👤 Отклонил(а): ${adminName}`;

        const cleanBaseText = (message.text || '').replace(/⏳ Статус: Ожидает обработки/g, '').trim();

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: `${cleanBaseText}\n\n━━━━━━━━━━━━━━━━━━━\n${statusTitle}`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{ text: '💬 Написать клиенту в WhatsApp', url: waDirectUrl }]]
            }
          })
        });

        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: id })
        });
      } catch (err) {
        console.error('Ошибка callback:', err);
      }
    }

    pollTelegramUpdates();
  }
};