import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::booking.booking', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;

    // Если запрос идет из админки и пользователь не является Super Admin
    if (user && user.roles?.some((role: any) => role.code !== 'strapi-super-admin')) {
      // Ищем баню, созданную этим пользователем
      const userBanya = await strapi.db.query('api::banya.banya').findOne({
        where: { createdBy: user.id }
      });

      if (!userBanya) {
        return { data: [], meta: { pagination: { total: 0 } } };
      }

      // Ограничиваем выборку броней только этой баней
      ctx.query = {
        ...ctx.query,
        filters: {
          ...(ctx.query.filters as object),
          banya: { id: userBanya.id }
        }
      };
    }

    return await super.find(ctx);
  }
}));