const mongoose = require('mongoose');

const chatbotSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    websiteUrl: {
      type: String,
      trim: true,
    },
    persona: {
      type: String,
      required: true,
      default: 'You are a helpful assistant.',
    },
    knowledgeBase: [
      {
        title: String,
        content: String,
        embedding: [Number],
        metadata: {
          source: String,
          page: Number,
          chunkIndex: Number,
        },
      },
    ],
    settings: {
      language: {
        type: String,
        default: 'en',
      },
      maxTokens: {
        type: Number,
        default: 500,
      },
      temperature: {
        type: Number,
        default: 0.7,
        min: 0,
        max: 2,
      },
      enableTTS: {
        type: Boolean,
        default: false,
      },
      enableLeadCapture: {
        type: Boolean,
        default: true,
      },
      allowedDomains: {
        type: [String],
        default: [],
      },
      llmProvider: {
        type: String,
        enum: ['openai', 'anthropic', 'grok'],
        default: 'openai',
      },
      // UI Configuration fields
      avatar_url: {
        type: String,
        default: '',
      },
      welcome_text: {
        type: String,
        default: '',
      },
      welcome_text_enabled: {
        type: Boolean,
        default: true,
      },
      welcome_rotating_two_lines: {
        type: Boolean,
        default: true,
      },
      assistant_display_name: {
        type: String,
        default: '',
      },
      assistant_logo_url: {
        type: String,
        default: '',
      },
      tab_title: {
        type: String,
        default: '',
      },
      favicon_url: {
        type: String,
        default: '',
      },
      input_placeholders_enabled: {
        type: Boolean,
        default: false,
      },
      input_placeholders: {
        type: [String],
        default: ["Ask me anything...", "How can I help you?", "What would you like to know?"],
      },
      input_placeholder_speed: {
        type: Number,
        default: 2.5,
      },
      input_placeholder_animation: {
        type: String,
        default: 'typewriter',
      },
      chat_background: {
        enabled: {
          type: Boolean,
          default: false,
        },
        image_url: {
          type: String,
          default: '',
        },
        opacity: {
          type: Number,
          default: 10,
          min: 5,
          max: 80,
        },
        style: {
          type: String,
          enum: ['cover', 'watermark', 'pattern'],
          default: 'watermark',
        },
      },
      // Skater Girl animation configuration
      skater_girl: {
        enabled: {
          type: Boolean,
          default: true,
        },
        messages: {
          type: [String],
          default: [
            "Let's talk business 🤝",
            "I've got answers 💡",
            "24×7 at your service ⚡",
            "Go on, test me! 😏",
            "What can I solve? ✅",
            "Psst... ask me! 🧠",
          ],
        },
      },
      // Sidebar configuration
      sidebar: {
        enabled: {
          type: Boolean,
          default: false,
        },
        user_dashboard_allowed_menu_keys: {
          type: [String],
          default: [],
        },
        user_dashboard_enabled: {
          type: Boolean,
          default: true,
        },
        whatsapp: {
          enabled: {
            type: Boolean,
            default: false,
          },
          mode: {
            type: String,
            default: 'link',
          },
          url: {
            type: String,
            default: '',
          },
          text: {
            type: String,
            default: '',
          },
        },
        call: {
          enabled: {
            type: Boolean,
            default: false,
          },
          mode: {
            type: String,
            default: 'link',
          },
          number: {
            type: String,
            default: '',
          },
          text: {
            type: String,
            default: '',
          },
        },
        calendly: {
          enabled: {
            type: Boolean,
            default: false,
          },
          mode: {
            type: String,
            default: 'link',
          },
          url: {
            type: String,
            default: '',
          },
          text: {
            type: String,
            default: '',
          },
          pat: {
            type: String,
            default: '',
          },
          eventTypeUri: {
            type: String,
            default: '',
          },
        },
        email: {
          enabled: {
            type: Boolean,
            default: false,
          },
          mode: {
            type: String,
            default: 'link',
          },
          text: {
            type: String,
            default: '',
          },
        },
        whatsapp_proposal: {
          enabled: {
            type: Boolean,
            default: false,
          },
          display_text: {
            type: String,
            default: 'Get Quote',
          },
          default_api_key: {
            type: String,
            default: '',
          },
          default_org_slug: {
            type: String,
            default: '',
          },
          default_sender_name: {
            type: String,
            default: '',
          },
          default_country_code: {
            type: String,
            default: '91',
          },
        },
        social: {
          enabled: {
            type: Boolean,
            default: false,
          },
        },
        branding: {
          enabled: {
            type: Boolean,
            default: false,
          },
          branding_text: {
            type: String,
            default: 'Powered by',
          },
          branding_company: {
            type: String,
            default: 'Troika Tech',
          },
          branding_logo_url: {
            type: String,
            default: '',
          },
          branding_logo_link: {
            type: String,
            default: '',
          },
        },
        header: {
          enabled: {
            type: Boolean,
            default: false,
          },
          header_text: {
            type: String,
            default: '',
          },
          header_logo_url: {
            type: String,
            default: '',
          },
          header_logo_link: {
            type: String,
            default: '',
          },
          /** When true, show header nav; items come from header_nav_items or chat UI defaults */
          header_nav_enabled: {
            type: Boolean,
            default: true,
          },
          /** Label shown in header + full prompt sent to chat (knowledge base). */
          header_nav_items: {
            type: [
              {
                label: { type: String, trim: true, default: '' },
                prompt: { type: String, default: '' },
              },
            ],
            default: [],
          },
        },
        custom_nav: {
          enabled: {
            type: Boolean,
            default: false,
          },
          items: [{
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            display_text: { type: String, required: true, maxlength: 100 },
            icon_name: { type: String, required: true }, // Font Awesome icon name
            redirect_url: { type: String, required: true },
            is_active: { type: Boolean, default: true },
            order: { type: Number, default: 0 },
          }],
        },
        whatsapp_number: {
          type: String,
          default: '',
        },
        call_number: {
          type: String,
          default: '',
        },
      },
      authentication: {
        isEnabled: { type: Boolean, default: false }
      },
      // Intent-based Proposal Configuration
      intentEnabled: {
        type: Boolean,
        default: false,
      },
      intentKeywords: {
        type: [String],
        default: ['proposal', 'quote', 'pricing', 'quotation', 'estimate'],
      },
      proposal_condition: {
        type: String,
        default: 'User is asking for a proposal, quote, pricing, or wants to see costs',
      },
      proposal_campaign_name: {
        type: String,
        default: '',
      },
      proposal_template_name: {
        type: String,
        default: null,
      },
      intentMedia: {
        url: { type: String, default: null },
        filename: { type: String, default: null },
      },
      intentPromptForChoice: {
        type: Boolean,
        default: false,
      },
      intentTemplateAllowlist: {
        type: [String],
        default: [],
      },
      intentConfirmationText: {
        type: String,
        default: 'Would you like me to send the proposal to your WhatsApp number?',
      },
      intentTemplateChoiceText: {
        type: String,
        default: 'Which proposal would you like me to send?',
      },
      intentSuccessMessage: {
        type: String,
        default: '✅ Proposal sent to your WhatsApp number!',
      },
      intentToastMessage: {
        type: String,
        default: 'Proposal sent successfully! 📱',
      },
      intentPositiveResponses: {
        type: [String],
        default: ['yes', 'yep', 'sure', 'ok', 'send it', 'please', 'go ahead', 'yes please'],
      },
      intentNegativeResponses: {
        type: [String],
        default: ['no', 'not now', 'later', 'maybe later', 'not yet'],
      },
      intentTimeoutMinutes: {
        type: Number,
        default: 5,
      },
      // Email Intent Configuration
      email_intent: {
        enabled: {
          type: Boolean,
          default: false,
        },
        condition: {
          type: String,
          default: 'User wants to receive information via email',
        },
        confirmation_prompt_text: {
          type: String,
          default: 'Would you like to receive this via email?',
        },
        template_choice_prompt_text: {
          type: String,
          default: 'Which email template would you like?',
        },
        template_choice_allowlist: {
          type: [String],
          default: [],
        },
        success_message: {
          type: String,
          default: '✅ Email sent successfully!',
        },
        toast_message: {
          type: String,
          default: 'Email sent!',
        },
        prompt_for_template_choice: {
          type: Boolean,
          default: false,
        },
        positive_responses: {
          type: [String],
          default: ['yes', 'sure', 'ok', 'send it', 'please', 'go ahead'],
        },
        negative_responses: {
          type: [String],
          default: ['no', 'cancel', "don't", 'skip'],
        },
      },
      // Calling Tool Configuration
      calling_tool: {
        enabled: {
          type: Boolean,
          default: false,
        },
        condition: {
          type: String,
          default: 'User wants to talk to a human, has a complex query, or specifically asks for a call',
        },
        api_key: {
          type: String,
          default: '',
        },
        agent_id: {
          type: String,
          default: '',
        },
        flow_question: {
          type: String,
          default: 'Would you like me to connect you via a call?',
        },
        positive_responses: {
          type: [String],
          default: ['yes', 'sure', 'ok', 'call me', 'connect me', 'please', 'go ahead'],
        },
        negative_responses: {
          type: [String],
          default: ['no', 'not now', 'later', 'maybe later', 'not yet', 'stop'],
        },
        timeout_minutes: {
          type: Number,
          default: 10,
        },
      },
      // Product Images Configuration (S3-based)
      product_images: {
        enabled: {
          type: Boolean,
          default: false,
        },
        main_keyword: {
          type: String,
          default: '',
        },
        images: [{
          url: { type: String, required: true },
          name: { type: String, default: '' },
          keywords: [String],
          uploadDate: { type: Date, default: Date.now }
        }],
      },
      // Proposal Templates (shared by both sidebar and intent)
      proposalTemplates: {
        type: [{
          _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
          display_name: { type: String, required: true },
          description: { type: String, default: '' },
          campaign_name: { type: String, required: true },
          template_name: { type: String, required: true },
          api_key: { type: String, default: null },
          org_slug: { type: String, default: null },
          sender_name: { type: String, default: null },
          country_code: { type: String, default: '91' },
          media: {
            url: { type: String, default: null },
            filename: { type: String, default: null },
          },
          template_params: {
            type: [{
              param_name: { type: String, required: true },
              param_value: { type: String, required: true },
              is_dynamic: { type: Boolean, default: false },
            }],
            default: [],
          },
          order: { type: Number, default: 0 },
          is_active: { type: Boolean, default: true },
        }],
        default: [],
      },
    },
    customization: {
      primaryColor: {
        type: String,
        default: '#0066FF',
      },
      fontFamily: {
        type: String,
        default: 'Inter',
      },
      position: {
        type: String,
        enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
        default: 'bottom-right',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    credits: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
      expiresAt: { type: Date, default: null },
      lastResetAt: { type: Date, default: null }
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Indexes
chatbotSchema.index({ company: 1 });
chatbotSchema.index({ isActive: 1 });
chatbotSchema.index({ 'knowledgeBase.embedding': '2dsphere' });

module.exports = mongoose.model('Chatbot', chatbotSchema);

