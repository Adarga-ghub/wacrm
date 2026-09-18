/**
 * Client-side language toggle for the Payments *admin* panel
 * (`/payments`, `/payments/skins`) — separate from `next-intl`
 * (`src/i18n/request.ts`), which picks ONE locale for the whole
 * self-hosted deployment from an env var and has no Spanish
 * dictionary at all (only `en`/`ko`). This lets a merchant flip the
 * Billing & Payments panel to Spanish regardless of the deployment's
 * configured locale, mirroring the same pattern already used for the
 * public `/pay/[slug]` checkout page
 * (`src/lib/payments/pay-page-i18n.ts`).
 *
 * English strings here are copied from `messages/en.json`'s
 * `Payments.list` / `Payments.skins` namespaces at the time this was
 * written — next-intl's copies remain the source of truth for any
 * other page still reading those namespaces (the form editor,
 * transactions, gateway settings), so if you change wording there,
 * mirror it here too for the pages this toggle actually covers.
 */
export type AdminLocale = 'es' | 'en'

export interface PaymentsListStrings {
  title: string
  subtitle: string
  configureGateway: string
  transactions: string
  skins: string
  newForm: string
  emptyTitle: string
  emptyDesc: string
  loadFailed: string
  duplicateFailed: string
  duplicateSuccess: string
  archiveFailed: string
  archiveSuccess: string
  archiveTitle: string
  archiveDesc: string
  cancel: string
  table: {
    name: string
    status: string
    amount: string
    created: string
    variableAmount: string
  }
  status: {
    draft: string
    published: string
    archived: string
  }
  actions: {
    edit: string
    duplicate: string
    archive: string
    menu: string
  }
}

export interface PaymentsSkinsStrings {
  back: string
  title: string
  subtitle: string
  newSkin: string
  editTitle: string
  dialogDesc: string
  emptyTitle: string
  emptyDesc: string
  loadFailed: string
  nameLabel: string
  namePlaceholder: string
  accentColorLabel: string
  logoUrlLabel: string
  backgroundTitle: string
  backgroundColorTab: string
  backgroundImageTab: string
  backgroundColorLabel: string
  backgroundImageLabel: string
  backgroundFillLabel: string
  backgroundRepeatLabel: string
  backgroundFixedLabel: string
  topSectionTitle: string
  bannerImageLabel: string
  productImageLabel: string
  titleLabel: string
  titlePlaceholder: string
  titleSizeLabel: string
  subtitleLabel: string
  subtitlePlaceholder: string
  subtitleSizeLabel: string
  formsLabel: string
  formsHint: string
  formsEmpty: string
  formsReassignHint: string
  cancel: string
  create: string
  save: string
  createFailed: string
  createSuccess: string
  saveFailed: string
  saveSuccess: string
  deleteTitle: string
  deleteDesc: string
  deleteFailed: string
  deleteSuccess: string
  table: {
    name: string
    forms: string
    created: string
    formsCount: string
  }
  actions: {
    edit: string
    delete: string
    menu: string
  }
}

export interface PaymentsAdminNamespaces {
  list: PaymentsListStrings
  skins: PaymentsSkinsStrings
}

export const paymentsAdminStrings: Record<AdminLocale, PaymentsAdminNamespaces> = {
  en: {
    list: {
      title: 'Billing & Payments',
      subtitle:
        'Build PayPal checkout forms and send files automatically when a payment is confirmed.',
      configureGateway: 'Configure PayPal',
      transactions: 'Transactions',
      skins: 'Payment Skins',
      newForm: 'New form',
      emptyTitle: 'No payment forms yet',
      emptyDesc: 'Create your first checkout form, connect PayPal, and wire it to an automation.',
      loadFailed: 'Could not load your payment forms.',
      duplicateFailed: 'Could not duplicate the form.',
      duplicateSuccess: 'Form duplicated.',
      archiveFailed: 'Could not archive the form.',
      archiveSuccess: 'Form archived.',
      archiveTitle: 'Archive this form?',
      archiveDesc: '"{name}" will stop accepting new payments. Existing transaction history is kept.',
      cancel: 'Cancel',
      table: {
        name: 'Name',
        status: 'Status',
        amount: 'Amount',
        created: 'Created',
        variableAmount: 'Variable',
      },
      status: {
        draft: 'Draft',
        published: 'Published',
        archived: 'Archived',
      },
      actions: {
        edit: 'Edit',
        duplicate: 'Duplicate',
        archive: 'Archive',
        menu: 'Open menu',
      },
    },
    skins: {
      back: 'Payment forms',
      title: 'Payment Skins',
      subtitle:
        'Reusable checkout designs — create one appearance and apply it to as many payment forms as you like.',
      newSkin: 'New skin',
      editTitle: 'Edit skin',
      dialogDesc:
        'This design applies everywhere the skin is linked — editing it updates every form below at once.',
      emptyTitle: 'No payment skins yet',
      emptyDesc: 'Create a reusable checkout appearance and apply it to one or more payment forms.',
      loadFailed: 'Could not load your payment skins.',
      nameLabel: 'Skin name',
      namePlaceholder: 'e.g. Black Friday',
      accentColorLabel: 'Accent color',
      logoUrlLabel: 'Logo URL',
      backgroundTitle: 'Background',
      backgroundColorTab: 'Color',
      backgroundImageTab: 'Image',
      backgroundColorLabel: 'Background color',
      backgroundImageLabel: 'Background image URL',
      backgroundFillLabel: 'Fill the page background',
      backgroundRepeatLabel: 'Repeat background image',
      backgroundFixedLabel: 'Fix image while scrolling',
      topSectionTitle: 'Top section',
      bannerImageLabel: 'Banner image URL',
      productImageLabel: 'Product image URL',
      titleLabel: 'Title',
      titlePlaceholder: 'Write a title for the page',
      titleSizeLabel: 'Title size',
      subtitleLabel: 'Subtitle',
      subtitlePlaceholder: 'Write a subtitle for the page',
      subtitleSizeLabel: 'Subtitle size',
      formsLabel: 'Applied to',
      formsHint: 'Select every payment form that should use this appearance.',
      formsEmpty: "You don't have any payment forms yet.",
      formsReassignHint: 'Switches from its current skin',
      cancel: 'Cancel',
      create: 'Create',
      save: 'Save',
      createFailed: 'Could not create the skin.',
      createSuccess: 'Skin created.',
      saveFailed: 'Could not save the skin.',
      saveSuccess: 'Skin saved.',
      deleteTitle: 'Delete this skin?',
      deleteDesc: '"{name}" will be removed and its forms will fall back to their own design. This can\'t be undone.',
      deleteFailed: 'Could not delete the skin.',
      deleteSuccess: 'Skin deleted.',
      table: {
        name: 'Name',
        forms: 'Forms',
        created: 'Created',
        formsCount: '{count} forms',
      },
      actions: {
        edit: 'Edit',
        delete: 'Delete',
        menu: 'Open menu',
      },
    },
  },
  es: {
    list: {
      title: 'Facturación y Pagos',
      subtitle:
        'Crea formularios de pago con PayPal y envía archivos automáticamente cuando se confirme un pago.',
      configureGateway: 'Configurar PayPal',
      transactions: 'Transacciones',
      skins: 'Apariencias de pago',
      newForm: 'Nuevo formulario',
      emptyTitle: 'Aún no hay formularios de pago',
      emptyDesc: 'Crea tu primer formulario de pago, conecta PayPal y vincúlalo a una automatización.',
      loadFailed: 'No se pudieron cargar tus formularios de pago.',
      duplicateFailed: 'No se pudo duplicar el formulario.',
      duplicateSuccess: 'Formulario duplicado.',
      archiveFailed: 'No se pudo archivar el formulario.',
      archiveSuccess: 'Formulario archivado.',
      archiveTitle: '¿Archivar este formulario?',
      archiveDesc: '"{name}" dejará de aceptar nuevos pagos. El historial de transacciones existente se conserva.',
      cancel: 'Cancelar',
      table: {
        name: 'Nombre',
        status: 'Estado',
        amount: 'Monto',
        created: 'Creado',
        variableAmount: 'Variable',
      },
      status: {
        draft: 'Borrador',
        published: 'Publicado',
        archived: 'Archivado',
      },
      actions: {
        edit: 'Editar',
        duplicate: 'Duplicar',
        archive: 'Archivar',
        menu: 'Abrir menú',
      },
    },
    skins: {
      back: 'Formularios de pago',
      title: 'Apariencias de pago',
      subtitle:
        'Diseños de pago reutilizables — crea una apariencia y aplícala a los formularios de pago que quieras.',
      newSkin: 'Nueva apariencia',
      editTitle: 'Editar apariencia',
      dialogDesc:
        'Este diseño se aplica en todos los formularios vinculados — al editarlo, se actualizan todos a la vez.',
      emptyTitle: 'Aún no hay apariencias de pago',
      emptyDesc: 'Crea una apariencia de pago reutilizable y aplícala a uno o varios formularios.',
      loadFailed: 'No se pudieron cargar tus apariencias de pago.',
      nameLabel: 'Nombre de la apariencia',
      namePlaceholder: 'ej. Black Friday',
      accentColorLabel: 'Color de acento',
      logoUrlLabel: 'URL del logo',
      backgroundTitle: 'Fondo',
      backgroundColorTab: 'Color',
      backgroundImageTab: 'Imagen',
      backgroundColorLabel: 'Color de fondo',
      backgroundImageLabel: 'URL de la imagen de fondo',
      backgroundFillLabel: 'Llenar el fondo de la página',
      backgroundRepeatLabel: 'Repetir imagen de fondo',
      backgroundFixedLabel: 'Fijar imagen durante el desplazamiento',
      topSectionTitle: 'Parte superior',
      bannerImageLabel: 'URL de la imagen de la parte superior',
      productImageLabel: 'URL de la imagen del producto',
      titleLabel: 'Título',
      titlePlaceholder: 'Escribe un título para la página',
      titleSizeLabel: 'Tamaño del título',
      subtitleLabel: 'Subtítulo',
      subtitlePlaceholder: 'Escribe un subtítulo para la página',
      subtitleSizeLabel: 'Tamaño del subtítulo',
      formsLabel: 'Aplicado a',
      formsHint: 'Selecciona los formularios de pago que deben usar esta apariencia.',
      formsEmpty: 'Aún no tienes formularios de pago.',
      formsReassignHint: 'Cambiará desde su apariencia actual',
      cancel: 'Cancelar',
      create: 'Crear',
      save: 'Guardar',
      createFailed: 'No se pudo crear la apariencia.',
      createSuccess: 'Apariencia creada.',
      saveFailed: 'No se pudo guardar la apariencia.',
      saveSuccess: 'Apariencia guardada.',
      deleteTitle: '¿Eliminar esta apariencia?',
      deleteDesc: '"{name}" se eliminará y sus formularios volverán a su propio diseño. Esta acción no se puede deshacer.',
      deleteFailed: 'No se pudo eliminar la apariencia.',
      deleteSuccess: 'Apariencia eliminada.',
      table: {
        name: 'Nombre',
        forms: 'Formularios',
        created: 'Creado',
        formsCount: '{count} formularios',
      },
      actions: {
        edit: 'Editar',
        delete: 'Eliminar',
        menu: 'Abrir menú',
      },
    },
  },
}
