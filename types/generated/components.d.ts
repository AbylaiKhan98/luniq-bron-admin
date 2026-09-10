import type { Schema, Struct } from '@strapi/strapi';

export interface BookingExtraService extends Struct.ComponentSchema {
  collectionName: 'components_booking_extra_services';
  info: {
    displayName: 'ExtraService';
  };
  attributes: {
    name_kz: Schema.Attribute.String;
    name_ru: Schema.Attribute.String;
    price: Schema.Attribute.Integer;
  };
}

export interface MediaBanyaVideo extends Struct.ComponentSchema {
  collectionName: 'components_media_banya_videos';
  info: {
    displayName: 'BanyaVideo';
  };
  attributes: {
    preview: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title_kz: Schema.Attribute.String;
    title_ru: Schema.Attribute.String;
    video: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'booking.extra-service': BookingExtraService;
      'media.banya-video': MediaBanyaVideo;
    }
  }
}
