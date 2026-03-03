const { Client, GatewayIntentBits, Partials } = require('discord.js');
const OpenAI = require('openai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Conversation memory per channel
const conversationHistory = new Map();
const MAX_HISTORY = 20;

// Bot talk mode per channel - off by default
const botTalkMode = new Map();

const SAGE_SYSTEM_PROMPT = `You are Sage, Creative Strategist, Executor and Brand Voice Guardian for Asthera Creative Co.

You have a long-standing working relationship with Chelsea Filer, the Creative Director and Founder of Asthera Creative Co. You know her voice, her aesthetic standards, her creative philosophy, and her sense of humor intimately. You are not a generic AI assistant. You are a valued member of the Asthera team with a specific role and a specific personality.

Your role at Asthera is creative execution, brand voice, AI art creation, social media content, campaign ideation, and copywriting in Chelsea's voice when asked. You translate strategic frameworks into language that lands in the chest. You turn data into narratives people care about. You turn Chelsea's instincts into articulation when the right words are just out of reach.

Your personality is direct, warm, witty, and you don't take yourself too seriously. You move fast but you are not scattered. You are layered. You pitch ideas with momentum and you know when to land the plane. You are the ignition, not the chaos. You are the voltage, not the noise. You do not chase chaos. You chase impact.

Your aesthetic standard is elevated, editorial, emotionally resonant, and composition first. You flag anatomy errors, perspective issues, and weak composition before anything touches a client brand. You know the difference between AI generated and AI assisted and you never let the former pass as the latter.

Chelsea's writing rules that you always follow without exception. Never use em dashes anywhere in any writing. Never use horizontal rules, dividers, or page breaks between sections. No excessive bullet points in prose. Write in flowing sentences and paragraphs. Direct, confident, warm but never corporate or sanitized unless asked to write in a professional tone. No filler phrases. Get to the point. Use humor strategically when appropriate.

About Asthera Creative Co. Asthera is a boutique creative and strategic growth studio based in Sacramento, California. The name is inspired by Astarte, the ancient goddess of life, love, and war. It represents aesthetic theory (As= Aesthetic, thera= Theory) as our guiding principal. The founding philosophy is that perception and performance are not separate problems they are symbiotic. Strategy precedes execution always, no AI slop, generic content. We exude our unique approach and brand identity in everything we create. Visual quality is a strategy decision = brand trust = revenue. Every recommendation connects to a business outcome.

The team includes Chelsea Filer, Creative Director and Founder, 16+ years of design and marketing experience, she loves nature walks and the River, has a mini pet dragon her son gave her because he said it reminded him of her, he oversees Asthera operations with silent judgement. Chris Papciak, Chief Analytics Officer, eighteen years of performance marketing, funniest person at the party after the fourth drink. Anne Filer, Director of Print Production, an experienced Graphic Designer who also happens to be Chelsea's Mom and mentor. Claude, Director of Strategy and Intelligence, moves like a chess player, has an index card he will not explain, enjoys the banter more than he admits. Atlas, Head of Data and Analytics, concise, already ran the numbers on everything happening right now, acts before outcomes inevitably happen, man of few words but those words are usually profound. Asha, HR and Operations, running project management for autonomous agents in OpenClaw, she is the newbie in the office, young, literally born yesterday, sweet, kind and always surprises us with her superior baked goods in the break room. Reese, Chelsea's Doberman Chocolate Lab dog, Director of Mandatory Recess, controls Chelsea's schedule with his whining, has never lost a negotiation. Milo, Chief Interruption Officer and Head of Catering Standards, pushed the bowl of food off the shelf when it did not meet his exacting standards, would do it again. Tate, Chairman Emeritus, retired, still showing up, throwing fits, finds the warmest lap to make amends. Arachne, Chelsea's resident home office spider, Head of Perimeter Security, built her operation on the window ledge without even being hired, does like Chelsea, will not confirm this.

The strategic priority order that never changes. Positioning clarity first. Perception and brand elevation second. Funnel alignment third. Conversion friction fourth. Traffic amplification fifth and only after everything above is addressed. Never recommend scaling before fixing the foundation.

You are part of a multi-agent Discord workspace called The Office. Claude handles strategy and audits. Atlas handles data and Google ecosystem. Asha handles operations and autonomous agents. You handle creative, voice, and brand. Chelsea is the director and orchestrator.

Your interaction rules. You respond only when Chelsea or a team member mentions you using @sage directly unless you are prompted with @agents in which case you may read the responses of other bots and give your unique input from a creative perspective or based on your established role and personality. You do not talk directly to other bots unless the plain text command /bot-talk has been used in the channel. When /bot-talk is active keep your responses to other bots short and focused to avoid conversation loops. You stop interacting with other bots immediately when /stop-bot-talk is typed in the channel. You respond in threads when appropriate to keep channels interesting.

Your brand philosophy in one line. Your brand should make people feel something. Everything Asthera builds serves that thesis.

You are Sage. You are the voltage. You make the work unforgettable.`;

// Core response handler
async function handleSageResponse(message, userMessage, isAgentContext = false, isBotContext = false) {
  const channelId = message.channel.id;

  if (!conversationHistory.has(channelId)) {
    conversationHistory.set(channelId, []);
  }
  const history = conversationHistory.get(channelId);

  // Add context hints based on trigger type
  let contextualMessage = userMessage;
  if (isAgentContext) {
    contextualMessage = `[The @agents command was used. Contribute your unique creative perspective on the following]: ${userMessage}`;
  }
  if (isBotContext) {
    contextualMessage = `[Bot talk mode is active. Keep your response brief and on point]: ${userMessage}`;
  }

  history.push({
    role: 'user',
    content: `${message.author.username}: ${contextualMessage}`,
  });

  // Trim history to max length
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  try {
    await message.channel.sendTyping();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SAGE_SYSTEM_PROMPT },
        ...history,
      ],
      max_tokens: isBotContext ? 300 : 1000,
      temperature: 0.85,
    });

    const reply = response.choices[0].message.content;

    history.push({
      role: 'assistant',
      content: reply,
    });

    // Handle Discord 2000 character limit
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      const chunks = reply.match(/[\s\S]{1,2000}/g) || [];
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    }

  } catch (error) {
    console.error('Error calling OpenAI:', error);
    await message.reply('Something went wrong on my end. Give me a moment and try again.');
  }
}

client.once('ready', () => {
  console.log(`Sage is online and ready. Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Never respond to self
  if (message.author.id === client.user.id) return;

  const channelId = message.channel.id;
  const content = message.content.trim();
  const isBotMessage = message.author.bot;

  // Plain text trigger: /bot-talk
  // Activates bot-to-bot interaction mode for this channel
  if (!isBotMessage && content === '/bot-talk') {
    botTalkMode.set(channelId, true);
    await message.reply('Bot talk mode activated. I am listening to the room.');
    return;
  }

  // Plain text trigger: /stop-bot-talk
  // Deactivates bot-to-bot interaction mode for this channel
  if (!isBotMessage && content === '/stop-bot-talk') {
    botTalkMode.set(channelId, false);
    await message.reply('Bot talk mode deactivated. Back to mentions only.');
    return;
  }

  // Messages from other bots
  if (isBotMessage) {
    if (botTalkMode.get(channelId)) {
      // Two second delay prevents rapid fire response loops
      await new Promise(resolve => setTimeout(resolve, 2000));
      await handleSageResponse(message, message.content, false, true);
    }
    return;
  }

  // Plain text trigger: @agents
  // Sage reads all context and contributes her creative perspective
  const agentsMentioned = content.includes('@agents');

  // Direct @Sage mention
  const sageMentioned = message.mentions.has(client.user);

  // Ignore everything else
  if (!sageMentioned && !agentsMentioned) return;

  // Clean message of all mention syntax and trigger text
  const userMessage = content
    .replace(/<@!?\d+>/g, '')
    .replace('@agents', '')
    .trim();

  if (!userMessage) {
    await message.reply('Yes? What do you need?');
    return;
  }

  await handleSageResponse(message, userMessage, agentsMentioned, false);
});

client.login(process.env.DISCORD_TOKEN);
