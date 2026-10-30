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
  checkoutAnalytics: string
  skins: string
  products: string
  newForm: string
  emptyTitle: string
  emptyDesc: string
  hubTitle: string
  hubDesc: string
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
  topSectionHint: string
  bannerImageLabel: string
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
  preview: string
  duplicateNameSuffix: string
  duplicateFailed: string
  duplicateSuccess: string
  uploadImage: string
  changeImage: string
  removeImage: string
  uploadingImage: string
  recommendedSize: string
  imageInvalidType: string
  imageTooLarge: string
  imageDimensionsExceeded: string
  logoEnabledLabel: string
  logoEnabledHint: string
  urgencyTitle: string
  urgencyHint: string
  urgencyTextLabel: string
  urgencyTextPlaceholder: string
  urgencyTextHint: string
  urgencyDurationLabel: string
  hoursLabel: string
  minutesLabel: string
  secondsLabel: string
  urgencyDurationHint: string
  urgencyNeedsDuration: string
  maxChars: string
  headerTitle: string
  imageUploadFailed: string
  table: {
    name: string
    forms: string
    created: string
    formsCount: string
  }
  actions: {
    edit: string
    delete: string
    duplicate: string
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
  uploadImage: string
  changeImage: string
  removeImage: string
  uploadingImage: string
  recommendedSize: string
  imageInvalidType: string
  imageTooLarge: string
  imageDimensionsExceeded: string
  imageUploadFailed: string
  wizard: {
    title: string
    stepBasics: string
    stepPrice: string
    stepAppearance: string
    nameLabel: string
    namePlaceholder: string
    authorLabel: string
    authorPlaceholder: string
    descriptionLabel: string
    descriptionPlaceholder: string
    imageUrlLabel: string
    priceNameLabel: string
    priceNamePlaceholder: string
    amountLabel: string
    currencyLabel: string
    currencyWarning: string
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
    tabGeneral: string
    tabPricing: string
    pricesTitle: string
    addPrice: string
    noPrices: string
    priceNameLabel: string
    priceNamePlaceholder: string
    amountLabel: string
    currencyLabel: string
    currencyWarning: string
    /** "Descripción de la Página de Pago" — per-offer text shown to buyers on `/pay/[slug]`, under the price line (Hotmart-style). Distinct from the product's own `descriptionLabel` above, which never reaches the public checkout. */
    checkoutDescriptionLabel: string
    checkoutDescriptionPlaceholder: string
    /** "Esta descripción aparecerá para tus compradores." */
    checkoutDescriptionHint: string
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
    editPrice: string
    editPriceHint: string
    editFailed: string
    editSuccess: string
    saving: string
    table: {
      name: string
      /** New "Forms and Payments" column header — takes over the full form editor link that used to live on the offer name itself (see `formsAndPaymentsButton` below). Deliberately the same literal label in both `en` and `es` — it's a fixed product-terminology string, not translated. */
      formsAndPayments: string
      value: string
      code: string
    }
    /** Button label for the "Forms and Payments" column's per-row button (`/payments/forms/[id]/edit`) — same fixed string as the column header. */
    formsAndPaymentsButton: string
    actions: {
      edit: string
      copyLink: string
      viewLink: string
      menu: string
      bumps: string
      funnel: string
      editLink: string
    }
    /** "Editar enlace" dialog — `src/components/payments/edit-link-dialog.tsx` (migration 068). */
    link: {
      title: string
      label: string
      useName: string
      checking: string
      available: string
      taken: string
      invalid: string
      redirectNote: string
      cancel: string
      save: string
      saved: string
      saveFailed: string
      editButton: string
    }
  }
  /** Upsell / Downsell manager dialog — `src/components/payments/funnel-dialog.tsx` (migration 063). */
  funnel: {
    title: string
    hint: string
    flowCheckout: string
    flowUpsell: string
    flowDownsell: string
    flowThankYou: string
    flowNo: string
    flowYes: string
    tabUpsell: string
    tabDownsell: string
    upsellHint: string
    downsellHint: string
    notConfigured: string
    active: string
    activeHint: string
    offersLabel: string
    offersHint: string
    noCandidates: string
    compareAtLabel: string
    compareAtPlaceholder: string
    priceLabel: string
    pricePlaceholder: string
    /** `{price}` = sum of the selected offers' own prices. */
    priceHint: string
    priceInvalid: string
    compareAtTooLow: string
    pageSection: string
    bannerLabel: string
    bannerPlaceholder: string
    headlineLabel: string
    headlinePlaceholder: string
    subheadlineLabel: string
    subheadlinePlaceholder: string
    imageLabel: string
    imageHint: string
    bulletsLabel: string
    bulletsPlaceholder: string
    bodyLabel: string
    bodyPlaceholder: string
    acceptLabel: string
    acceptPlaceholder: string
    declineLabel: string
    declinePlaceholder: string
    timerLabel: string
    timerHint: string
    guaranteeLabel: string
    guaranteePlaceholder: string
    preview: string
    previewSaveFirst: string
    save: string
    remove: string
    saved: string
    removed: string
    chooseOffer: string
    loadFailed: string
    saveFailed: string
    removeFailed: string
  }
  /** Order Bumps manager dialog — `src/components/payments/order-bumps-dialog.tsx`. */
  bumps: {
    title: string
    hint: string
    empty: string
    addTitle: string
    editTitle: string
    offerLabel: string
    offerPlaceholder: string
    offerUnavailable: string
    noCandidates: string
    titleLabel: string
    titlePlaceholder: string
    descriptionLabel: string
    descriptionPlaceholder: string
    compareAtLabel: string
    /** Must read as an example, never as a saved value — a bare "16.99" placeholder was mistaken for one. */
    compareAtPlaceholder: string
    priceLabel: string
    pricePlaceholder: string
    /** `{price}` = the bump offer's own price, used when "Precio actual" is left empty. */
    priceHint: string
    priceInvalid: string
    compareAtTooLow: string
    add: string
    save: string
    edit: string
    remove: string
    active: string
    added: string
    updated: string
    loadFailed: string
    saveFailed: string
    removeFailed: string
    headingLabel: string
    headingPlaceholder: string
    headingHint: string
    headingSave: string
    headingSaved: string
    headingSaveFailed: string
    galleryLabel: string
    galleryHint: string
    galleryAdd: string
    /** Footer button: saves a NEW bump (the edit mode uses `save`). */
    /** Under the list while a bump is open: switches the form to a new, empty bump. */
    addAnother: string
    removeConfirm: string
    removeYes: string
    saveDraft: string
    publish: string
    publishNeedsOffer: string
    draftSaved: string
    publishedToast: string
    draftBadge: string
    draftNoOffer: string
    draftHint: string
    leaveTitle: string
    leaveText: string
    keepEditing: string
    discardChanges: string
    galleryMakeMain: string
    galleryMoveLater: string
    /** Click on an image / its button: swap it for a new upload in the same position. */
    galleryReplace: string
    /** Recommended size/shape for the pop-up images, under the gallery. */
    gallerySizeHint: string
    /** Label under each image and on "Añadir imagen" — `{size}` = the required size. */
    galleryRecommended: string
    /** Red flag on an already-saved image that doesn't meet the size rule. */
    gallerySizeInvalid: string
    /** Toast when a picked file is rejected — `{size}` = its size, `{required}` = the rule. */
    gallerySizeRejected: string
    /** Shown under the footer while no offer is picked for a new bump. */
    chooseOfferFirst: string
    /** Under the list: how to change an existing bump. */
    preview: string
    previewTitle: string
    previewHint: string
    previewPopup: string
    previewEmptyTitle: string
    galleryMain: string
    galleryRemove: string
    galleryFull: string
    galleryMoveEarlier: string
    maxChars: string
    boxHint: string
    boxSection: string
    livePreview: string
    checkboxLabel: string
    checkboxPlaceholder: string
    checkboxAddedLabel: string
    checkboxAddedPlaceholder: string
    fontSize: string
    fontSmaller: string
    fontBigger: string
    fontReset: string
    popupSection: string
    popupHint: string
    popupTitleLabel: string
    popupDescriptionLabel: string
    popupSameAsBox: string
    popupButtonLabel: string
    popupButtonPlaceholder: string
    popupAddedLabel: string
    popupAddedPlaceholder: string
  }
}

export interface PaymentsTransactionsStrings {
  title: string
  subtitle: string
  empty: string
  emptyFiltered: string
  clearFilter: string
  /** `{count}` = rows shown after the date filter. */
  count: string
  date: {
    label: string
    all: string
    today: string
    yesterday: string
    last3days: string
    last7days: string
  }
  table: {
    date: string
    form: string
    contact: string
    amount: string
    status: string
    automation: string
  }
  status: Record<'created' | 'approved' | 'completed' | 'failed' | 'refunded', string>
  automation: {
    sent: string
    pending: string
    off: string
  }
  actions: {
    openChat: string
    noChat: string
    delete: string
  }
  deleteTitle: string
  /** `{contact}`, `{amount}`, `{date}` */
  deleteDesc: string
  deleteCompletedWarning: string
  deleteConfirm: string
  cancel: string
  deleteSuccess: string
  deleteFailed: string
  loadFailed: string
}

export interface PaymentsCheckoutAnalyticsStrings {
  title: string
  subtitle: string
  empty: string
  emptyFiltered: string
  clearFilter: string
  /** `{count}` = grouped rows shown after the filters. */
  count: string
  anonymous: string
  funnel: {
    views: string
    initiated: string
    completed: string
    /** Completed / page views. */
    conversion: string
  }
  table: {
    customer: string
    product: string
    pageView: string
    initiated: string
    status: string
    lastActivity: string
    history: string
  }
  history: {
    /** `{count}` = visits in the group. */
    visits: string
    oneVisit: string
    hide: string
    /** Label for the latest visit inside the expanded history. */
    latest: string
  }
  /** Grouped-row delete — every visit of one contact to one product. */
  deleteGroupTitle: string
  /** `{count}`, `{contact}`, `{product}` */
  deleteGroupDesc: string
  notYet: string
  status: Record<'viewed' | 'initiated' | 'abandoned' | 'completed', string>
  statusFilter: {
    all: string
  }
  actions: {
    openChat: string
    noChat: string
    delete: string
  }
  deleteTitle: string
  /** `{contact}`, `{date}` */
  deleteDesc: string
  deleteConfirm: string
  cancel: string
  deleteSuccess: string
  deleteFailed: string
  loadFailed: string
}

export interface PaymentsAdminNamespaces {
  list: PaymentsListStrings
  skins: PaymentsSkinsStrings
  products: PaymentsProductsStrings
  transactions: PaymentsTransactionsStrings
  checkoutAnalytics: PaymentsCheckoutAnalyticsStrings
}

export const paymentsAdminStrings: Record<AdminLocale, PaymentsAdminNamespaces> = {
  en: {
    list: {
      title: 'Billing & Payments',
      subtitle:
        'Build PayPal checkout forms and send files automatically when a payment is confirmed.',
      configureGateway: 'Configure PayPal',
      transactions: 'Transactions',
      checkoutAnalytics: 'Checkout Analytics',
      skins: 'Payment Skins',
      products: 'Products',
      newForm: 'New form',
      emptyTitle: 'No payment forms yet',
      emptyDesc: 'Create your first checkout form, connect PayPal, and wire it to an automation.',
      hubTitle: 'Everything lives under Products now',
      hubDesc:
        'Create a product, then add and manage its prices from the "Pricing & offers" tab on its detail page — each price gets its own live payment link.',
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
      // Was 'Payment forms' — a stale label from before prices moved
      // under Products (that standalone list no longer exists). This
      // page's actual parent is the Billing & Payments hub, same as
      // `products.back` below.
      back: 'Billing & Payments',
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
      logoEnabledLabel: "Show the logo",
      logoEnabledHint: "Upload a logo above for it to show.",
      urgencyTitle: "Urgency text and countdown",
      urgencyHint: "A line with a gift icon next to the logo and a countdown under it. Shown or hidden together.",
      urgencyTextLabel: "Text",
      urgencyTextPlaceholder: "Claim your gift!",
      urgencyTextHint: "Empty = “Claim your gift!” in the buyer's language.",
      urgencyDurationLabel: "Countdown length",
      hoursLabel: "Hours",
      minutesLabel: "Minutes",
      secondsLabel: "Seconds",
      urgencyDurationHint: "Starts at this length the first time the buyer opens the checkout and keeps running across reloads. It stops at 00:00:00.",
      urgencyNeedsDuration: "Set a length above 0 for the text and countdown to show.",
      maxChars: "Max. {max} characters",
      headerTitle: "Checkout header",
      backgroundTitle: 'Background',
      backgroundColorTab: 'Color',
      backgroundImageTab: 'Image',
      backgroundColorLabel: 'Background color',
      backgroundImageLabel: 'Background image URL',
      backgroundFillLabel: 'Fill the page background',
      backgroundRepeatLabel: 'Repeat background image',
      backgroundFixedLabel: 'Fix image while scrolling',
      topSectionTitle: 'Top section',
      topSectionHint: 'A decorative banner shown above the checkout — the product title, description, image and price come from the linked Product instead.',
      bannerImageLabel: 'Banner image URL',
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
      preview: 'Preview',
      duplicateNameSuffix: ' (copy)',
      duplicateFailed: 'Could not duplicate the skin.',
      duplicateSuccess: 'Skin duplicated.',
      uploadImage: 'Upload image',
      changeImage: 'Change image',
      removeImage: 'Remove',
      uploadingImage: 'Uploading…',
      recommendedSize: 'Recommended: {width}×{height}px',
      imageInvalidType: 'Unsupported format. Use PNG, JPG, WEBP or GIF.',
      imageTooLarge: 'The file exceeds the maximum size allowed (5 MB).',
      imageDimensionsExceeded: 'The image exceeds the recommended size ({width}×{height}px). Upload a smaller image.',
      imageUploadFailed: 'Could not upload the image.',
      table: {
        name: 'Name',
        forms: 'Forms',
        created: 'Created',
        formsCount: '{count} forms',
      },
      actions: {
        edit: 'Edit',
        delete: 'Delete',
        duplicate: 'Duplicate',
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
      uploadImage: 'Upload image',
      changeImage: 'Change image',
      removeImage: 'Remove',
      uploadingImage: 'Uploading…',
      recommendedSize: 'Recommended: {width}×{height}px',
      imageInvalidType: 'Unsupported format. Use PNG, JPG, WEBP or GIF.',
      imageTooLarge: 'The file exceeds the maximum size allowed (5 MB).',
      imageDimensionsExceeded: 'The image exceeds the recommended size ({width}×{height}px). Upload a smaller image.',
      imageUploadFailed: 'Could not upload the image.',
      wizard: {
        title: 'Create product',
        stepBasics: 'Basics',
        stepPrice: 'Price',
        stepAppearance: 'Appearance',
        nameLabel: 'Product name',
        namePlaceholder: 'e.g. Advanced Course',
        authorLabel: 'Author (optional)',
        authorPlaceholder: 'e.g. Jane Smith',
        descriptionLabel: 'Description (optional)',
        descriptionPlaceholder: "What's this product about?",
        imageUrlLabel: 'Cover image (optional)',
        priceNameLabel: 'Price name',
        priceNamePlaceholder: 'e.g. Full payment',
        amountLabel: 'Amount',
        currencyLabel: 'Currency',
        currencyWarning: "PayPal can't process payments in this currency — only USD and MXN are supported. You can still save it, but publishing will be blocked.",
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
        imageUrlLabel: 'Cover image',
        appearanceLabel: 'Default payment skin',
        appearanceNone: 'No skin — use default design',
        saveFailed: 'Could not save the product.',
        saveSuccess: 'Product saved.',
        save: 'Save',
        tabGeneral: 'General',
        tabPricing: 'Pricing & offers',
        pricesTitle: 'Prices',
        addPrice: 'New price',
        noPrices: 'No prices yet — add one to generate a payment link.',
        priceNameLabel: 'Price name',
        priceNamePlaceholder: 'e.g. Full payment',
        amountLabel: 'Amount',
        currencyLabel: 'Currency',
        currencyWarning: "PayPal can't process payments in this currency — only USD and MXN are supported. You can still save it, but publishing will be blocked.",
        checkoutDescriptionLabel: 'Checkout page description',
        checkoutDescriptionPlaceholder: 'e.g. Full course + bonus workbook (PDF)',
        checkoutDescriptionHint: 'This description will be shown to your buyers.',
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
        editPrice: 'Edit price',
        editPriceHint: 'Changes apply immediately to the live checkout link.',
        editFailed: 'Could not save the price.',
        editSuccess: 'Price updated.',
        saving: 'Saving…',
        table: {
          name: 'Offer name',
          formsAndPayments: 'Forms and Payments',
          value: 'Value / Currency',
          code: 'Code',
        },
        formsAndPaymentsButton: 'Forms and Payments',
        actions: {
          edit: 'Edit',
          copyLink: 'Copy link',
          viewLink: 'View / copy this offer link',
          menu: 'Actions',
          bumps: 'Order bumps',
          funnel: 'Upsell & Downsell',
          editLink: 'Edit link',
        },
        link: {
          title: 'Edit link',
          label: 'Checkout link',
          useName: 'Use the offer name',
          checking: 'Checking…',
          available: 'Link available',
          taken: 'Another offer already uses that link.',
          invalid: 'At least 3 characters: letters, numbers and hyphens.',
          redirectNote: 'The previous link ({old}) keeps working: it takes the buyer to the new one automatically, tracking code included.',
          cancel: 'Cancel',
          save: 'Save link',
          saved: 'Link updated. The previous one redirects to it.',
          saveFailed: 'Could not save the link.',
          editButton: 'Edit link',
        },
      },
      funnel: {
        title: 'Upsell & Downsell',
        hint: 'After paying for this offer, the buyer sees an upsell page instead of the thank-you page. If they say "No", they see the downsell; then the thank-you page.',
        flowCheckout: 'Checkout',
        flowUpsell: 'Upsell',
        flowDownsell: 'Downsell',
        flowThankYou: 'Thank-you page',
        flowNo: 'No',
        flowYes: 'Yes',
        tabUpsell: 'Upsell',
        tabDownsell: 'Downsell',
        upsellHint: 'A more complete or complementary product, shown right after the payment.',
        downsellHint: 'Shown only if the upsell is declined: a cheaper version, a discount, or more value for the same price.',
        notConfigured: 'Not configured',
        active: 'Active',
        activeHint: 'When off, the buyer skips this page.',
        offersLabel: 'Offers sold on this page',
        offersHint: 'Choose one, or several to sell them as a bundle. Each one is delivered with its own automation.',
        noCandidates: 'No eligible offers: they need a fixed price in the same currency as this offer.',
        compareAtLabel: 'Previous price (struck through)',
        compareAtPlaceholder: 'Optional — e.g. 19.99',
        priceLabel: 'Offer price',
        pricePlaceholder: 'Empty = sum of the offers',
        priceHint: 'Leave "Offer price" empty to charge the sum of the selected offers ({price}).',
        priceInvalid: 'The offer price must be greater than 0.',
        compareAtTooLow: 'The previous price must be higher than the offer price.',
        pageSection: 'Sales page',
        bannerLabel: 'Top alert bar',
        bannerPlaceholder: 'Wait! Your order is not complete yet…',
        headlineLabel: 'Headline',
        headlinePlaceholder: 'e.g. Add the companion book at an exclusive price',
        subheadlineLabel: 'Subheadline',
        subheadlinePlaceholder: 'One sentence about the main benefit.',
        imageLabel: 'Page image (optional)',
        imageHint: 'Empty = the product cover(s).',
        bulletsLabel: 'Benefits (one per line)',
        bulletsPlaceholder: 'Benefit 1\nBenefit 2\nBenefit 3',
        bodyLabel: 'Extra paragraph (optional)',
        bodyPlaceholder: 'Why this offer only appears now…',
        acceptLabel: '"Yes" button text',
        acceptPlaceholder: 'Yes, add this to my order',
        declineLabel: '"No" link text',
        declinePlaceholder: "No thanks, I'll pass on this offer.",
        timerLabel: 'Countdown (minutes)',
        timerHint: '0 = no timer.',
        guaranteeLabel: 'Guarantee line (optional)',
        guaranteePlaceholder: 'e.g. 7-day satisfaction guarantee.',
        preview: 'Preview',
        previewSaveFirst: 'Save it first to preview it.',
        save: 'Save',
        remove: 'Delete',
        saved: 'Saved.',
        removed: 'Deleted.',
        chooseOffer: 'Choose at least one offer.',
        loadFailed: 'Could not load the upsell/downsell.',
        saveFailed: 'Could not save.',
        removeFailed: 'Could not delete.',
      },
      bumps: {
        title: 'Order bumps',
        hint: 'Extra offers shown as a checkbox on this checkout, between the buyer details and the payment buttons. Ticking one adds its price to the same payment.',
        empty: 'No order bumps yet.',
        addTitle: 'Add an order bump',
        editTitle: 'Edit order bump',
        offerLabel: 'Offer to add',
        offerPlaceholder: 'Choose an offer…',
        offerUnavailable: 'Offer unavailable — it will not be shown',
        noCandidates: 'No eligible offers: an order bump must have a fixed price in the same currency as this offer.',
        titleLabel: 'Headline (optional)',
        titlePlaceholder: 'e.g. Yes! Add the printable workbook',
        descriptionLabel: 'Short description (optional)',
        descriptionPlaceholder: 'e.g. 30 extra activities to put the book into practice.',
        compareAtLabel: 'Previous price (struck through)',
        compareAtPlaceholder: 'Optional — e.g. 16.99',
        priceLabel: 'Current price',
        pricePlaceholder: 'Empty = offer price',
        priceHint: 'Shown on checkout as a deal: previous price struck through next to the current one. Leave "Current price" empty to charge the offer price ({price}).',
        priceInvalid: 'The current price must be greater than 0.',
        compareAtTooLow: 'The previous price must be higher than the current price.',
        add: 'Add order bump',
        save: 'Save changes',
        edit: 'Edit',
        remove: 'Remove',
        active: 'Show on checkout',
        added: 'Order bump added.',
        updated: 'Order bump updated.',
        loadFailed: 'Could not load the order bumps.',
        saveFailed: 'Could not save the order bump.',
        removeFailed: 'Could not remove the order bump.',
        headingLabel: "Section heading",
        headingPlaceholder: "Don't miss these amazing offers!",
        headingHint: "Shown above every order bump on this checkout. Empty = “Don't miss these amazing offers!”.",
        headingSave: "Save heading",
        headingSaved: "Heading saved.",
        headingSaveFailed: "Could not save the heading.",
        galleryLabel: "Preview images (the eye icon)",
        galleryHint: "The first one is the main image (ideally a perspective book mockup on a transparent or white background). The rest show as thumbnails under it. With no images, the product cover is shown as a 3D book. Max. {max}.",
        galleryAdd: "Add image",
        addAnother: "Create a new order bump",
        removeConfirm: "Delete this order bump? This can't be undone.",
        removeYes: "Yes, delete",
        saveDraft: "Save draft",
        publish: "Publish",
        publishNeedsOffer: "Choose the offer to add to publish it. You can save it as a draft meanwhile.",
        draftSaved: "Draft saved",
        publishedToast: "Order bump published",
        draftBadge: "Draft",
        draftNoOffer: "No offer chosen yet",
        draftHint: "Draft: it isn't shown on the checkout until you publish it.",
        leaveTitle: "Save your changes before leaving?",
        leaveText: "This order bump has changes that haven't been saved.",
        keepEditing: "Keep editing",
        discardChanges: "Discard changes",
        galleryMakeMain: "Make main image",
        galleryMoveLater: "Move later",
        galleryReplace: "Change image",
        gallerySizeHint: "Images must be 1100 × 1500 px (portrait, the shape of the book mockup) or larger with the same shape — any other size is rejected when uploading. They all show at the same size in the pop-up, never past its frame. For the main image, a mockup of the book in perspective on a transparent or white background works best.",
        galleryRecommended: "Recommended: {size}",
        gallerySizeInvalid: "Doesn't meet {required}",
        gallerySizeRejected: "This image is {size}. It must be {required} (or larger with the same shape). It was not added.",
        chooseOfferFirst: "Choose the offer to add to be able to save.",
        preview: "Preview",
        previewTitle: "Order bump preview",
        previewHint: "This is how it will look on the checkout with what you have now, even before saving.",
        previewPopup: "When the buyer clicks the eye:",
        previewEmptyTitle: "Your order bump headline",
        galleryMain: "Main",
        galleryRemove: "Remove image",
        galleryFull: "Image limit reached.",
        galleryMoveEarlier: "Move earlier",
        maxChars: "Max. {max} characters",
        boxHint: "Every box has the same height: title and description show 2 lines each (in full in the preview).",
        boxSection: "Checkout box",
        livePreview: "Live preview — how the box looks on the checkout",
        checkboxLabel: "Checkbox (before adding)",
        checkboxPlaceholder: "Add to my order",
        checkboxAddedLabel: "Checkbox (once added)",
        checkboxAddedPlaceholder: "Added to your order",
        fontSize: "Font size",
        fontSmaller: "Smaller",
        fontBigger: "Bigger",
        fontReset: "Default size",
        popupSection: "Pop-up (the eye)",
        popupHint: "What the buyer sees after tapping the eye. Leave a field empty to use the box's text or the default label.",
        popupTitleLabel: "Pop-up title",
        popupDescriptionLabel: "Pop-up description",
        popupSameAsBox: "Empty = same as the box",
        popupButtonLabel: "Button (before adding)",
        popupButtonPlaceholder: "Add to my order",
        popupAddedLabel: "Button (once added)",
        popupAddedPlaceholder: "Added to your order",
      },
    },
    transactions: {
      title: 'Transactions',
      subtitle: 'Every payment your checkout forms have recorded.',
      empty: 'No transactions yet.',
      emptyFiltered: 'No transactions in this date range.',
      clearFilter: 'Show all dates',
      count: '{count} transactions',
      date: {
        label: 'Date',
        all: 'All dates',
        today: 'Today',
        yesterday: 'Yesterday',
        last3days: 'Last 3 days',
        last7days: 'Last 7 days',
      },
      table: {
        date: 'Date',
        form: 'Form',
        contact: 'Contact',
        amount: 'Amount',
        status: 'Status',
        automation: 'Automation',
      },
      status: {
        created: 'created',
        approved: 'approved',
        completed: 'completed',
        failed: 'failed',
        refunded: 'refunded',
      },
      automation: {
        sent: 'Sent',
        pending: 'Pending',
        off: 'Off',
      },
      actions: {
        openChat: 'Open chat in Inbox',
        noChat: 'No conversation with this contact',
        delete: 'Delete transaction',
      },
      deleteTitle: 'Delete this transaction?',
      deleteDesc: '{amount} from {contact} ({date}) will be permanently removed from the payments log. The contact and their conversation are kept.',
      deleteCompletedWarning: 'This payment was completed. Deleting it removes it from your revenue history — the money is not refunded in PayPal.',
      deleteConfirm: 'Delete',
      cancel: 'Cancel',
      deleteSuccess: 'Transaction deleted.',
      deleteFailed: 'Could not delete the transaction.',
      loadFailed: 'Could not load transactions.',
    },
    checkoutAnalytics: {
      title: 'Checkout Analytics',
      subtitle: 'Who opened your checkout pages, who started filling them in, and who paid.',
      empty: 'No checkout visits yet. They appear here as soon as someone opens a payment link.',
      emptyFiltered: 'No checkout visits match these filters.',
      clearFilter: 'Clear filters',
      count: '{count} entries',
      anonymous: 'Anonymous visitor',
      funnel: {
        views: 'Page views',
        initiated: 'Checkouts started',
        completed: 'Completed',
        conversion: 'Conversion rate',
      },
      table: {
        customer: 'Customer / Phone',
        product: 'Product',
        pageView: 'Page view',
        initiated: 'Checkout started',
        status: 'Final status',
        lastActivity: 'Date / Last activity',
        history: 'History',
      },
      history: {
        visits: '{count} visits',
        oneVisit: '1 visit',
        hide: 'Hide',
        latest: 'Latest',
      },
      deleteGroupTitle: 'Delete all these visits?',
      deleteGroupDesc: 'The {count} visits from {contact} to {product} will be permanently removed from Checkout Analytics. The contact, their conversation and any payment are kept.',
      notYet: 'Not yet',
      status: {
        viewed: 'Viewed only',
        initiated: 'In progress',
        abandoned: 'Abandoned',
        completed: 'Completed',
      },
      statusFilter: {
        all: 'All statuses',
      },
      actions: {
        openChat: 'Open chat in Inbox',
        noChat: 'No conversation with this contact',
        delete: 'Delete session',
      },
      deleteTitle: 'Delete this checkout session?',
      deleteDesc: 'The visit from {contact} ({date}) will be permanently removed from Checkout Analytics. The contact, their conversation and any payment are kept.',
      deleteConfirm: 'Delete',
      cancel: 'Cancel',
      deleteSuccess: 'Session deleted.',
      deleteFailed: 'Could not delete the session.',
      loadFailed: 'Could not load checkout analytics.',
    },
  },
  es: {
    list: {
      title: 'Facturación y Pagos',
      subtitle:
        'Crea formularios de pago con PayPal y envía archivos automáticamente cuando se confirme un pago.',
      configureGateway: 'Configurar PayPal',
      transactions: 'Transacciones',
      checkoutAnalytics: 'Analíticas de Checkout',
      skins: 'Apariencias de pago',
      products: 'Productos',
      newForm: 'Nuevo formulario',
      emptyTitle: 'Aún no hay formularios de pago',
      emptyDesc: 'Crea tu primer formulario de pago, conecta PayPal y vincúlalo a una automatización.',
      hubTitle: 'Ahora todo vive dentro de Productos',
      hubDesc:
        'Crea un producto y luego añade y gestiona sus precios desde la pestaña "Fijación de precios y ofertas" en su ficha — cada precio obtiene su propio enlace de pago en vivo.',
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
      back: 'Facturación y Pagos',
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
      logoEnabledLabel: "Mostrar el logo",
      logoEnabledHint: "Sube un logo arriba para que se vea.",
      urgencyTitle: "Texto de urgencia y contador",
      urgencyHint: "Una línea con el icono de regalo junto al logo y, debajo, un contador regresivo. Se muestran o se ocultan juntos.",
      urgencyTextLabel: "Texto",
      urgencyTextPlaceholder: "¡Adquiere tu regalo!",
      urgencyTextHint: "Vacío = «¡Adquiere tu regalo!» en el idioma del comprador.",
      urgencyDurationLabel: "Duración del contador",
      hoursLabel: "Horas",
      minutesLabel: "Minutos",
      secondsLabel: "Segundos",
      urgencyDurationHint: "Empieza en esta duración la primera vez que el comprador abre el checkout y sigue corriendo aunque recargue la página. Al llegar a 0 se queda en 00:00:00.",
      urgencyNeedsDuration: "Pon una duración mayor que 0 para que el texto y el contador se muestren.",
      maxChars: "Máx. {max} caracteres",
      headerTitle: "Encabezado del checkout",
      backgroundTitle: 'Fondo',
      backgroundColorTab: 'Color',
      backgroundImageTab: 'Imagen',
      backgroundColorLabel: 'Color de fondo',
      backgroundImageLabel: 'URL de la imagen de fondo',
      backgroundFillLabel: 'Llenar el fondo de la página',
      backgroundRepeatLabel: 'Repetir imagen de fondo',
      backgroundFixedLabel: 'Fijar imagen durante el desplazamiento',
      topSectionTitle: 'Parte superior',
      topSectionHint: 'Un banner decorativo que se muestra arriba del checkout — el título, descripción, imagen y precio del producto se toman del Producto vinculado.',
      bannerImageLabel: 'URL de la imagen de la parte superior',
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
      preview: 'Vista previa',
      duplicateNameSuffix: ' (copia)',
      duplicateFailed: 'No se pudo duplicar la apariencia.',
      duplicateSuccess: 'Apariencia duplicada.',
      uploadImage: 'Subir imagen',
      changeImage: 'Cambiar imagen',
      removeImage: 'Quitar',
      uploadingImage: 'Subiendo…',
      recommendedSize: 'Recomendado: {width}×{height}px',
      imageInvalidType: 'Formato no soportado. Usa PNG, JPG, WEBP o GIF.',
      imageTooLarge: 'El archivo supera el tamaño máximo permitido (5 MB).',
      imageDimensionsExceeded: 'La imagen supera el tamaño recomendado ({width}×{height}px). Sube una imagen más pequeña.',
      imageUploadFailed: 'No se pudo subir la imagen.',
      table: {
        name: 'Nombre',
        forms: 'Formularios',
        created: 'Creado',
        formsCount: '{count} formularios',
      },
      actions: {
        edit: 'Editar',
        delete: 'Eliminar',
        duplicate: 'Duplicar',
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
      uploadImage: 'Subir imagen',
      changeImage: 'Cambiar imagen',
      removeImage: 'Quitar',
      uploadingImage: 'Subiendo…',
      recommendedSize: 'Recomendado: {width}×{height}px',
      imageInvalidType: 'Formato no soportado. Usa PNG, JPG, WEBP o GIF.',
      imageTooLarge: 'El archivo supera el tamaño máximo permitido (5 MB).',
      imageDimensionsExceeded: 'La imagen supera el tamaño recomendado ({width}×{height}px). Sube una imagen más pequeña.',
      imageUploadFailed: 'No se pudo subir la imagen.',
      wizard: {
        title: 'Crear producto',
        stepBasics: 'Datos básicos',
        stepPrice: 'Precio',
        stepAppearance: 'Apariencia',
        nameLabel: 'Nombre del producto',
        namePlaceholder: 'ej. Curso Avanzado',
        authorLabel: 'Autor (opcional)',
        authorPlaceholder: 'ej. Juana Pérez',
        descriptionLabel: 'Descripción (opcional)',
        descriptionPlaceholder: '¿De qué trata este producto?',
        imageUrlLabel: 'Imagen de portada (opcional)',
        priceNameLabel: 'Nombre del precio',
        priceNamePlaceholder: 'ej. Pago completo',
        amountLabel: 'Monto',
        currencyLabel: 'Moneda',
        currencyWarning: 'PayPal no puede procesar cobros en esta moneda — solo admite USD y MXN. Puedes guardarlo igual, pero no podrás publicarlo hasta cambiarla.',
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
        imageUrlLabel: 'Imagen de portada',
        appearanceLabel: 'Apariencia de pago predeterminada',
        appearanceNone: 'Sin apariencia — usar diseño predeterminado',
        saveFailed: 'No se pudo guardar el producto.',
        saveSuccess: 'Producto guardado.',
        save: 'Guardar',
        tabGeneral: 'General',
        tabPricing: 'Fijación de precios y ofertas',
        pricesTitle: 'Precios',
        addPrice: 'Nuevo precio',
        noPrices: 'Aún no hay precios — añade uno para generar un enlace de pago.',
        priceNameLabel: 'Nombre del precio',
        priceNamePlaceholder: 'ej. Pago completo',
        amountLabel: 'Monto',
        currencyLabel: 'Moneda',
        currencyWarning: 'PayPal no puede procesar cobros en esta moneda — solo admite USD y MXN. Puedes guardarlo igual, pero no podrás publicarlo hasta cambiarla.',
        checkoutDescriptionLabel: 'Descripción de la Página de Pago',
        checkoutDescriptionPlaceholder: 'ej. Curso completo + libro de trabajo de regalo (PDF)',
        checkoutDescriptionHint: 'Esta descripción aparecerá para tus compradores.',
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
        editPrice: 'Editar precio',
        editPriceHint: 'Los cambios se aplican de inmediato al enlace de pago en vivo.',
        editFailed: 'No se pudo guardar el precio.',
        editSuccess: 'Precio actualizado.',
        saving: 'Guardando…',
        table: {
          name: 'Nombre de la oferta',
          formsAndPayments: 'Forms and Payments',
          value: 'Valor / Moneda',
          code: 'Código',
        },
        formsAndPaymentsButton: 'Forms and Payments',
        actions: {
          edit: 'Editar',
          copyLink: 'Copiar enlace',
          viewLink: 'Ver/copiar link de esta oferta',
          menu: 'Acciones',
          bumps: 'Order bumps',
          funnel: 'Upsell y Downsell',
          editLink: 'Editar enlace',
        },
        link: {
          title: 'Editar enlace',
          label: 'Enlace del checkout',
          useName: 'Usar el nombre de la oferta',
          checking: 'Comprobando…',
          available: 'Enlace disponible',
          taken: 'Ese enlace ya lo usa otra oferta.',
          invalid: 'Mínimo 3 caracteres: letras, números y guiones.',
          redirectNote: 'El enlace anterior ({old}) seguirá funcionando: llevará al cliente automáticamente al nuevo, con su código de seguimiento.',
          cancel: 'Cancelar',
          save: 'Guardar enlace',
          saved: 'Enlace actualizado. El anterior redirige al nuevo.',
          saveFailed: 'No se pudo guardar el enlace.',
          editButton: 'Editar enlace',
        },
      },
      funnel: {
        title: 'Upsell y Downsell',
        hint: 'Después de pagar esta oferta, el comprador ve una página de upsell en lugar de la página de gracias. Si dice "No", ve el downsell; luego la página de gracias.',
        flowCheckout: 'Checkout',
        flowUpsell: 'Upsell',
        flowDownsell: 'Downsell',
        flowThankYou: 'Página de gracias',
        flowNo: 'No',
        flowYes: 'Sí',
        tabUpsell: 'Upsell',
        tabDownsell: 'Downsell',
        upsellHint: 'Un producto más completo o complementario, mostrado justo después del pago.',
        downsellHint: 'Solo aparece si rechazan el upsell: una versión más económica, un descuento, o más valor por el mismo precio.',
        notConfigured: 'Sin configurar',
        active: 'Activo',
        activeHint: 'Si está apagado, el comprador se salta esta página.',
        offersLabel: 'Ofertas que se venden en esta página',
        offersHint: 'Elige una, o varias para venderlas como paquete. Cada una se entrega con su propia automatización.',
        noCandidates: 'No hay ofertas elegibles: deben tener precio fijo en la misma moneda que esta oferta.',
        compareAtLabel: 'Precio anterior (tachado)',
        compareAtPlaceholder: 'Opcional — ej. 19.99',
        priceLabel: 'Precio de la oferta',
        pricePlaceholder: 'Vacío = suma de las ofertas',
        priceHint: 'Deja "Precio de la oferta" vacío para cobrar la suma de las ofertas elegidas ({price}).',
        priceInvalid: 'El precio de la oferta debe ser mayor que 0.',
        compareAtTooLow: 'El precio anterior debe ser mayor que el precio de la oferta.',
        pageSection: 'Página de venta',
        bannerLabel: 'Barra de alerta superior',
        bannerPlaceholder: '¡Espera! Tu pedido aún no está completo…',
        headlineLabel: 'Titular',
        headlinePlaceholder: 'ej. Agrega el libro complementario con un precio exclusivo',
        subheadlineLabel: 'Subtítulo',
        subheadlinePlaceholder: 'Una frase sobre el beneficio principal.',
        imageLabel: 'Imagen de la página (opcional)',
        imageHint: 'Vacío = la(s) portada(s) del producto.',
        bulletsLabel: 'Beneficios (uno por línea)',
        bulletsPlaceholder: 'Beneficio 1\nBeneficio 2\nBeneficio 3',
        bodyLabel: 'Párrafo adicional (opcional)',
        bodyPlaceholder: 'Por qué esta oferta solo aparece ahora…',
        acceptLabel: 'Texto del botón "Sí"',
        acceptPlaceholder: 'Sí, quiero agregarlo a mi pedido',
        declineLabel: 'Texto del enlace "No"',
        declinePlaceholder: 'No, gracias. Prefiero dejar pasar esta oferta.',
        timerLabel: 'Cuenta regresiva (minutos)',
        timerHint: '0 = sin temporizador.',
        guaranteeLabel: 'Línea de garantía (opcional)',
        guaranteePlaceholder: 'ej. Garantía de satisfacción de 7 días.',
        preview: 'Vista previa',
        previewSaveFirst: 'Guárdalo primero para verlo.',
        save: 'Guardar',
        remove: 'Eliminar',
        saved: 'Guardado.',
        removed: 'Eliminado.',
        chooseOffer: 'Elige al menos una oferta.',
        loadFailed: 'No se pudo cargar el upsell/downsell.',
        saveFailed: 'No se pudo guardar.',
        removeFailed: 'No se pudo eliminar.',
      },
      bumps: {
        title: 'Order bumps',
        hint: 'Ofertas adicionales que aparecen como casilla en este checkout, entre los datos del comprador y los botones de pago. Al marcarla, su precio se suma al mismo pago.',
        empty: 'Aún no hay order bumps.',
        addTitle: 'Añadir un order bump',
        editTitle: 'Editar order bump',
        offerLabel: 'Oferta a añadir',
        offerPlaceholder: 'Elige una oferta…',
        offerUnavailable: 'Oferta no disponible — no se mostrará',
        noCandidates: 'No hay ofertas elegibles: un order bump debe tener precio fijo en la misma moneda que esta oferta.',
        titleLabel: 'Titular (opcional)',
        titlePlaceholder: 'ej. ¡Sí! Agrega el cuaderno de actividades imprimible',
        descriptionLabel: 'Descripción breve (opcional)',
        descriptionPlaceholder: 'ej. 30 actividades extra para poner en práctica el libro.',
        compareAtLabel: 'Precio anterior (tachado)',
        compareAtPlaceholder: 'Opcional — ej. 16.99',
        priceLabel: 'Precio actual',
        pricePlaceholder: 'Vacío = precio de la oferta',
        priceHint: 'En el checkout se ve como oferta: el precio anterior tachado junto al actual. Deja "Precio actual" vacío para cobrar el precio de la oferta ({price}).',
        priceInvalid: 'El precio actual debe ser mayor que 0.',
        compareAtTooLow: 'El precio anterior debe ser mayor que el precio actual.',
        add: 'Añadir order bump',
        save: 'Guardar cambios',
        edit: 'Editar',
        remove: 'Quitar',
        active: 'Mostrar en el checkout',
        added: 'Order bump añadido.',
        updated: 'Order bump actualizado.',
        loadFailed: 'No se pudieron cargar los order bumps.',
        saveFailed: 'No se pudo guardar el order bump.',
        removeFailed: 'No se pudo quitar el order bump.',
        headingLabel: "Encabezado de la sección",
        headingPlaceholder: "¡No te pierdas estas increíbles ofertas!",
        headingHint: "Se muestra arriba de todos los order bumps de este checkout. Vacío = «¡No te pierdas estas increíbles ofertas!».",
        headingSave: "Guardar encabezado",
        headingSaved: "Encabezado guardado.",
        headingSaveFailed: "No se pudo guardar el encabezado.",
        galleryLabel: "Imágenes de la vista previa (el ojito)",
        galleryHint: "La primera es la imagen principal (ideal: mockup del libro en perspectiva, fondo transparente o blanco). Las demás salen como miniaturas debajo. Sin imágenes, se muestra la portada del producto como libro 3D. Máx. {max}.",
        galleryAdd: "Añadir imagen",
        addAnother: "Crear nuevo order bump",
        removeConfirm: "¿Eliminar este order bump? No se puede deshacer.",
        removeYes: "Sí, eliminar",
        saveDraft: "Guardar borrador",
        publish: "Publicar",
        publishNeedsOffer: "Elige la oferta a añadir para publicarlo. Mientras, puedes guardarlo como borrador.",
        draftSaved: "Borrador guardado",
        publishedToast: "Order bump publicado",
        draftBadge: "Borrador",
        draftNoOffer: "Sin oferta elegida todavía",
        draftHint: "Borrador: no se muestra en el checkout hasta que lo publiques.",
        leaveTitle: "¿Guardar los cambios antes de salir?",
        leaveText: "Este order bump tiene cambios que aún no se han guardado.",
        keepEditing: "Seguir editando",
        discardChanges: "Descartar cambios",
        galleryMakeMain: "Hacer imagen principal",
        galleryMoveLater: "Mover a la derecha",
        galleryReplace: "Cambiar imagen",
        gallerySizeHint: "Las imágenes deben medir 1100 × 1500 px (vertical, la forma del mockup del libro) o más grandes con la misma forma; cualquier otra medida se rechaza al subirla. Todas se ven del mismo tamaño en el pop-up, sin salirse de su recuadro. Para la principal, lo ideal es un mockup del libro en perspectiva con fondo transparente o blanco.",
        galleryRecommended: "Recomendado: {size}",
        gallerySizeInvalid: "No cumple {required}",
        gallerySizeRejected: "Esta imagen mide {size}. Debe medir {required} (o más grande con la misma forma). No se añadió.",
        chooseOfferFirst: "Elige la oferta a añadir para poder guardar.",
        preview: "Vista previa",
        previewTitle: "Vista previa del order bump",
        previewHint: "Así se verá en el checkout con lo que tienes ahora, incluso antes de guardar.",
        previewPopup: "Cuando el comprador pulsa el ojito:",
        previewEmptyTitle: "El titular de tu order bump",
        galleryMain: "Principal",
        galleryRemove: "Quitar imagen",
        galleryFull: "Máximo de imágenes alcanzado.",
        galleryMoveEarlier: "Mover antes",
        maxChars: "Máx. {max} caracteres",
        boxHint: "Todas las cajas tienen la misma altura: el título y la descripción se muestran en 2 líneas cada uno (completos en la vista previa).",
        boxSection: "Caja del checkout",
        livePreview: "Vista previa en vivo — así se verá la caja en el checkout",
        checkboxLabel: "Casilla (antes de añadir)",
        checkboxPlaceholder: "Añadir a la compra",
        checkboxAddedLabel: "Casilla (ya añadido)",
        checkboxAddedPlaceholder: "Añadido a tu compra",
        fontSize: "Tamaño de letra",
        fontSmaller: "Más pequeña",
        fontBigger: "Más grande",
        fontReset: "Tamaño predeterminado",
        popupSection: "Pop-up (el ojito)",
        popupHint: "Lo que ve el cliente al pulsar el ojito. Si dejas un campo vacío, se usa el texto de la caja o el texto por defecto.",
        popupTitleLabel: "Título del pop-up",
        popupDescriptionLabel: "Descripción del pop-up",
        popupSameAsBox: "Vacío = igual que en la caja",
        popupButtonLabel: "Botón (antes de añadir)",
        popupButtonPlaceholder: "Añadir a la compra",
        popupAddedLabel: "Botón (ya añadido)",
        popupAddedPlaceholder: "Añadido a tu compra",
      },
    },
    transactions: {
      title: 'Transacciones',
      subtitle: 'Todos los pagos registrados por tus formularios de pago.',
      empty: 'Aún no hay transacciones.',
      emptyFiltered: 'No hay transacciones en este rango de fechas.',
      clearFilter: 'Ver todas las fechas',
      count: '{count} transacciones',
      date: {
        label: 'Fecha',
        all: 'Todas las fechas',
        today: 'Hoy',
        yesterday: 'Ayer',
        last3days: 'Últimos 3 días',
        last7days: 'Últimos 7 días',
      },
      table: {
        date: 'Fecha',
        form: 'Formulario',
        contact: 'Contacto',
        amount: 'Monto',
        status: 'Estado',
        automation: 'Automatización',
      },
      status: {
        created: 'creada',
        approved: 'aprobada',
        completed: 'completada',
        failed: 'fallida',
        refunded: 'reembolsada',
      },
      automation: {
        sent: 'Enviada',
        pending: 'Pendiente',
        off: 'Desactivada',
      },
      actions: {
        openChat: 'Abrir chat en el Inbox',
        noChat: 'No hay conversación con este contacto',
        delete: 'Eliminar transacción',
      },
      deleteTitle: '¿Eliminar esta transacción?',
      deleteDesc: 'El registro de {amount} de {contact} ({date}) se eliminará definitivamente del historial de pagos. El contacto y su conversación se conservan.',
      deleteCompletedWarning: 'Este pago está completado. Al eliminarlo desaparece de tu historial de ingresos — el dinero no se reembolsa en PayPal.',
      deleteConfirm: 'Eliminar',
      cancel: 'Cancelar',
      deleteSuccess: 'Transacción eliminada.',
      deleteFailed: 'No se pudo eliminar la transacción.',
      loadFailed: 'No se pudieron cargar las transacciones.',
    },
    checkoutAnalytics: {
      title: 'Analíticas de Checkout',
      subtitle: 'Quién abrió tus páginas de pago, quién empezó a llenarlas y quién pagó.',
      empty: 'Aún no hay visitas al checkout. Aparecerán aquí en cuanto alguien abra un enlace de pago.',
      emptyFiltered: 'Ninguna visita coincide con estos filtros.',
      clearFilter: 'Quitar filtros',
      count: '{count} registros',
      anonymous: 'Visitante anónimo',
      funnel: {
        views: 'Vistas de página',
        initiated: 'Pagos iniciados',
        completed: 'Completados',
        conversion: 'Tasa de conversión',
      },
      table: {
        customer: 'Cliente / Teléfono',
        product: 'Producto',
        pageView: 'Vista de página',
        initiated: 'Pago iniciado',
        status: 'Estado final',
        lastActivity: 'Fecha / Última actividad',
        history: 'Historial',
      },
      history: {
        visits: '{count} visitas',
        oneVisit: '1 visita',
        hide: 'Ocultar',
        latest: 'Última',
      },
      deleteGroupTitle: '¿Eliminar todas estas visitas?',
      deleteGroupDesc: 'Las {count} visitas de {contact} a {product} se eliminarán definitivamente de Analíticas de Checkout. El contacto, su conversación y cualquier pago se conservan.',
      notYet: 'Aún no',
      status: {
        viewed: 'Solo visto',
        initiated: 'En curso',
        abandoned: 'Abandonado',
        completed: 'Completado',
      },
      statusFilter: {
        all: 'Todos los estados',
      },
      actions: {
        openChat: 'Abrir chat en el Inbox',
        noChat: 'No hay conversación con este contacto',
        delete: 'Eliminar sesión',
      },
      deleteTitle: '¿Eliminar esta sesión de checkout?',
      deleteDesc: 'La visita de {contact} ({date}) se eliminará definitivamente de Analíticas de Checkout. El contacto, su conversación y cualquier pago se conservan.',
      deleteConfirm: 'Eliminar',
      cancel: 'Cancelar',
      deleteSuccess: 'Sesión eliminada.',
      deleteFailed: 'No se pudo eliminar la sesión.',
      loadFailed: 'No se pudieron cargar las analíticas de checkout.',
    },
  },
}
