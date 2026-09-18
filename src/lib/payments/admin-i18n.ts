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
  products: string
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

export interface PaymentsProductsStrings {
  back: string
  title: string
  subtitle: string
  newProduct: string
  emptyTitle: string
  emptyDesc: string
  loadFailed: string
  cancel: string
  table: {
    name: string
    status: string
    prices: string
    created: string
    pricesCount: string
  }
  status: {
    draft: string
    published: string
    archived: string
  }
  actions: {
    edit: string
    archive: string
    menu: string
  }
  archiveTitle: string
  archiveDesc: string
  archiveFailed: string
  archiveSuccess: string
  wizard: {
    title: string
    stepBasics: string
    stepPrice: string
    stepAppearance: string
    nameLabel: string
    namePlaceholder: string
    descriptionLabel: string
    descriptionPlaceholder: string
    imageUrlLabel: string
    priceNameLabel: string
    priceNamePlaceholder: string
    amountLabel: string
    appearanceLabel: string
    appearanceNone: string
    appearanceHint: string
    back: string
    next: string
    finish: string
    finishing: string
    createFailed: string
    priceFailed: string
    successTitle: string
    successDesc: string
    copyLink: string
    linkCopied: string
    done: string
  }
  detail: {
    descriptionLabel: string
    descriptionPlaceholder: string
    imageUrlLabel: string
    appearanceLabel: string
    appearanceNone: string
    saveFailed: string
    saveSuccess: string
    save: string
    pricesTitle: string
    addPrice: string
    noPrices: string
    priceNameLabel: string
    priceNamePlaceholder: string
    amountLabel: string
    publishNow: string
    publishHint: string
    create: string
    creating: string
    createFailed: string
    copyLink: string
    linkCopied: string
    viewLink: string
    loadFailed: string
    priceStatus: {
      draft: string
      published: string
    }
  }
}

export interface PaymentsAdminNamespaces {
  list: PaymentsListStrings
  skins: PaymentsSkinsStrings
  products: PaymentsProductsStrings
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
      products: 'Products',
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
    products: {
      back: 'Billing & Payments',
      title: 'Products',
      subtitle: 'Create a product once, then add one or more prices — each gets its own live payment link.',
      newProduct: 'Create product',
      emptyTitle: 'No products yet',
      emptyDesc: 'Create your first product, set a price, and get a payment link instantly.',
      loadFailed: 'Could not load your products.',
      cancel: 'Cancel',
      table: {
        name: 'Name',
        status: 'Status',
        prices: 'Prices',
        created: 'Created',
        pricesCount: '{count} prices',
      },
      status: {
        draft: 'Draft',
        published: 'Published',
        archived: 'Archived',
      },
      actions: {
        edit: 'Edit',
        archive: 'Archive',
        menu: 'Open menu',
      },
      archiveTitle: 'Archive this product?',
      archiveDesc: '"{name}" will be hidden from your product list. Its prices and transaction history are kept.',
      archiveFailed: 'Could not archive the product.',
      archiveSuccess: 'Product archived.',
      wizard: {
        title: 'Create product',
        stepBasics: 'Basics',
        stepPrice: 'Price',
        stepAppearance: 'Appearance',
        nameLabel: 'Product name',
        namePlaceholder: 'e.g. Advanced Course',
        descriptionLabel: 'Description (optional)',
        descriptionPlaceholder: "What's this product about?",
        imageUrlLabel: 'Cover image URL (optional)',
        priceNameLabel: 'Price name',
        priceNamePlaceholder: 'e.g. Full payment',
        amountLabel: 'Amount',
        appearanceLabel: 'Payment skin (optional)',
        appearanceNone: 'No skin — use default design',
        appearanceHint: 'Applies to every price you create for this product.',
        back: 'Back',
        next: 'Next',
        finish: 'Create and get link',
        finishing: 'Creating…',
        createFailed: 'Could not create the product.',
        priceFailed: 'Could not create the price.',
        successTitle: 'Product ready',
        successDesc: 'Your payment link is live:',
        copyLink: 'Copy link',
        linkCopied: 'Link copied to clipboard.',
        done: 'Done',
      },
      detail: {
        descriptionLabel: 'Description',
        descriptionPlaceholder: "What's this product about?",
        imageUrlLabel: 'Cover image URL',
        appearanceLabel: 'Default payment skin',
        appearanceNone: 'No skin — use default design',
        saveFailed: 'Could not save the product.',
        saveSuccess: 'Product saved.',
        save: 'Save',
        pricesTitle: 'Prices',
        addPrice: 'Add price',
        noPrices: 'No prices yet — add one to generate a payment link.',
        priceNameLabel: 'Price name',
        priceNamePlaceholder: 'e.g. Full payment',
        amountLabel: 'Amount',
        publishNow: 'Publish and generate link now',
        publishHint: 'Leave off to review it as a draft first.',
        create: 'Create price',
        creating: 'Creating…',
        createFailed: 'Could not create the price.',
        copyLink: 'Copy link',
        linkCopied: 'Link copied to clipboard.',
        viewLink: 'View',
        loadFailed: 'Could not load the product.',
        priceStatus: {
          draft: 'Draft',
          published: 'Published',
        },
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
      products: 'Productos',
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
    products: {
      back: 'Facturación y Pagos',
      title: 'Productos',
      subtitle: 'Crea un producto una vez y añádele uno o varios precios — cada uno obtiene su propio enlace de pago en vivo.',
      newProduct: 'Crear producto',
      emptyTitle: 'Aún no hay productos',
      emptyDesc: 'Crea tu primer producto, define un precio y obtén un enlace de pago al instante.',
      loadFailed: 'No se pudieron cargar tus productos.',
      cancel: 'Cancelar',
      table: {
        name: 'Nombre',
        status: 'Estado',
        prices: 'Precios',
        created: 'Creado',
        pricesCount: '{count} precios',
      },
      status: {
        draft: 'Borrador',
        published: 'Publicado',
        archived: 'Archivado',
      },
      actions: {
        edit: 'Editar',
        archive: 'Archivar',
        menu: 'Abrir menú',
      },
      archiveTitle: '¿Archivar este producto?',
      archiveDesc: '"{name}" se ocultará de tu lista de productos. Sus precios e historial de transacciones se conservan.',
      archiveFailed: 'No se pudo archivar el producto.',
      archiveSuccess: 'Producto archivado.',
      wizard: {
        title: 'Crear producto',
        stepBasics: 'Datos básicos',
        stepPrice: 'Precio',
        stepAppearance: 'Apariencia',
        nameLabel: 'Nombre del producto',
        namePlaceholder: 'ej. Curso Avanzado',
        descriptionLabel: 'Descripción (opcional)',
        descriptionPlaceholder: '¿De qué trata este producto?',
        imageUrlLabel: 'URL de la imagen de portada (opcional)',
        priceNameLabel: 'Nombre del precio',
        priceNamePlaceholder: 'ej. Pago completo',
        amountLabel: 'Monto',
        appearanceLabel: 'Apariencia de pago (opcional)',
        appearanceNone: 'Sin apariencia — usar diseño predeterminado',
        appearanceHint: 'Se aplica a cada precio que crees para este producto.',
        back: 'Atrás',
        next: 'Siguiente',
        finish: 'Crear y obtener enlace',
        finishing: 'Creando…',
        createFailed: 'No se pudo crear el producto.',
        priceFailed: 'No se pudo crear el precio.',
        successTitle: 'Producto listo',
        successDesc: 'Tu enlace de pago ya está activo:',
        copyLink: 'Copiar enlace',
        linkCopied: 'Enlace copiado al portapapeles.',
        done: 'Listo',
      },
      detail: {
        descriptionLabel: 'Descripción',
        descriptionPlaceholder: '¿De qué trata este producto?',
        imageUrlLabel: 'URL de la imagen de portada',
        appearanceLabel: 'Apariencia de pago predeterminada',
        appearanceNone: 'Sin apariencia — usar diseño predeterminado',
        saveFailed: 'No se pudo guardar el producto.',
        saveSuccess: 'Producto guardado.',
        save: 'Guardar',
        pricesTitle: 'Precios',
        addPrice: 'Añadir precio',
        noPrices: 'Aún no hay precios — añade uno para generar un enlace de pago.',
        priceNameLabel: 'Nombre del precio',
        priceNamePlaceholder: 'ej. Pago completo',
        amountLabel: 'Monto',
        publishNow: 'Publicar y generar enlace ahora',
        publishHint: 'Déjalo sin marcar para revisarlo primero como borrador.',
        create: 'Crear precio',
        creating: 'Creando…',
        createFailed: 'No se pudo crear el precio.',
        copyLink: 'Copiar enlace',
        linkCopied: 'Enlace copiado al portapapeles.',
        viewLink: 'Ver',
        loadFailed: 'No se pudo cargar el producto.',
        priceStatus: {
          draft: 'Borrador',
          published: 'Publicado',
        },
      },
    },
  },
}
