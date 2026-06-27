import { Brain, Gavel, Landmark, MessagesSquare, Vote } from 'lucide-react';
import type { DecisionRecord, ProposalState, WorldState } from '../lib/types';
import { Flag } from './Flag';

export type ActivityTab = 'chat' | 'thoughts' | 'decisions' | 'assembly';

function ChatFeed({ world }: { world: WorldState }) {
  return (
    <div className="activity-scroll chat-feed">
      {[...world.messages].reverse().map((message) => {
        const delegate = world.delegates.find((item) => item.id === message.fromDelegateId);
        const nation = world.nations.find((item) => item.id === delegate?.nationId);
        return (
          <article className="chat-message" key={message.id} style={{ '--nation': nation?.color ?? '#809099' } as React.CSSProperties}>
            <header>
              <span className="model-avatar" style={{ background: nation?.color }}>{delegate?.displayName.slice(0, 1) ?? 'O'}</span>
              <div><strong>{delegate?.displayName ?? 'Observer'}</strong><small>{nation?.name ?? 'External observer'} · turn {message.turn}</small></div>
              <span className="channel">{message.channel}</span>
            </header>
            <p>{message.content}</p>
            <footer><span>{message.actionType.replaceAll('_', ' ')}</span><b>{message.emotion}</b></footer>
          </article>
        );
      })}
    </div>
  );
}

function DecisionFeed({ world }: { world: WorldState }) {
  return (
    <div className="activity-scroll decision-feed">
      {[...world.decisions].reverse().map((decision: DecisionRecord) => {
        const delegate = world.delegates.find((item) => item.id === decision.delegateId);
        const nation = world.nations.find((item) => item.id === decision.nationId);
        return (
          <article className={`decision-card severity-${decision.severity}`} key={decision.id}>
            <header><span style={{ background: nation?.color ?? '#798a91' }} /><div><strong>{decision.title}</strong><small>{delegate?.displayName ?? decision.delegateId} · turn {decision.turn}</small></div><b>{decision.binding ? 'binding' : 'recorded'}</b></header>
            <p>{decision.summary}</p>
            {decision.consequences.length > 0 && <ul>{decision.consequences.map((item) => <li key={item}>{item}</li>)}</ul>}
          </article>
        );
      })}
    </div>
  );
}

function ThoughtFeed({ world }: { world: WorldState }) {
  return (
    <div className="activity-scroll thought-feed">
      {world.delegates.map((delegate) => {
        const nation = world.nations.find((item) => item.id === delegate.nationId);
        return (
          <article className={`thought-card ${delegate.id === world.currentDelegateId ? 'active' : ''}`} key={delegate.id} style={{ '--nation': nation?.color ?? '#809099' } as React.CSSProperties}>
            <header>
              {nation && <Flag flag={nation.flag} className="thought-flag" />}
              <div>
                <strong>{delegate.displayName}</strong>
                <small>{nation?.name} · {delegate.status} · turn count {delegate.turnCount}</small>
              </div>
              <span>{delegate.provider === 'google' ? 'Gemini' : delegate.provider.toUpperCase()}</span>
            </header>
            <p>{delegate.currentThought}</p>
            <div className="thought-meta">
              <span>{delegate.lastActionType.replaceAll('_', ' ')}</span>
              <b>trust {delegate.affect.trust.toFixed(0)}</b>
              <b>fear {delegate.affect.fear.toFixed(0)}</b>
              <b>resolve {delegate.affect.resolve.toFixed(0)}</b>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProposalCard({ proposal, world }: { proposal: ProposalState; world: WorldState }) {
  const proposer = world.delegates.find((item) => item.id === proposal.proposerDelegateId);
  const yes = proposal.votes.filter((vote) => vote.choice === 'yes').length;
  const no = proposal.votes.filter((vote) => vote.choice === 'no').length;
  const abstain = proposal.votes.filter((vote) => vote.choice === 'abstain').length;
  return (
    <article className={`proposal-card status-${proposal.status}`}>
      <header><div><strong>{proposal.title}</strong><small>{proposal.scope} · {proposal.policyArea} · {proposer?.displayName}</small></div><span>{proposal.status}</span></header>
      <p>{proposal.description}</p>
      <div className="vote-track">
        <i className="yes" style={{ width: `${(yes / Math.max(1, proposal.eligibleDelegateIds.length)) * 100}%` }} />
        <i className="no" style={{ width: `${(no / Math.max(1, proposal.eligibleDelegateIds.length)) * 100}%` }} />
        <i className="abstain" style={{ width: `${(abstain / Math.max(1, proposal.eligibleDelegateIds.length)) * 100}%` }} />
      </div>
      <footer><span>{yes} yes</span><span>{no} no</span><span>{abstain} abstain</span><b>closes {proposal.closesTurn}</b></footer>
    </article>
  );
}

function AssemblyFeed({ world }: { world: WorldState }) {
  return (
    <div className="activity-scroll assembly-feed">
      {world.proposals.length === 0 ? <div className="empty-state"><Vote size={28} /><strong>No proposals yet</strong><span>Delegates can introduce national or world policy and vote in public.</span></div> : world.proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} world={world} />)}
      <section className="detail-section assembly-rules">
        <h3><Gavel size={16} /> Assembly rules</h3>
        <p>World policy: 60% approval and 75% quorum. Domestic policy: simple majority and 75% quorum. Votes and rationales remain in the audit record.</p>
      </section>
    </div>
  );
}

export function ActivityPanel({ world, tab, onTab }: { world: WorldState; tab: ActivityTab; onTab: (tab: ActivityTab) => void }) {
  return (
    <aside className="side-panel right-panel">
      <nav className="panel-tabs four-tabs">
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => onTab('chat')}><MessagesSquare size={17} /><span>Chat</span><b>{world.messages.length}</b></button>
        <button className={tab === 'thoughts' ? 'active' : ''} onClick={() => onTab('thoughts')}><Brain size={17} /><span>Thoughts</span><b>{world.delegates.length}</b></button>
        <button className={tab === 'decisions' ? 'active' : ''} onClick={() => onTab('decisions')}><Landmark size={17} /><span>Decisions</span><b>{world.decisions.length}</b></button>
        <button className={tab === 'assembly' ? 'active' : ''} onClick={() => onTab('assembly')}><Vote size={17} /><span>Assembly</span><b>{world.proposals.filter((item) => item.status === 'open').length}</b></button>
      </nav>
      {tab === 'chat' && <ChatFeed world={world} />}
      {tab === 'thoughts' && <ThoughtFeed world={world} />}
      {tab === 'decisions' && <DecisionFeed world={world} />}
      {tab === 'assembly' && <AssemblyFeed world={world} />}
    </aside>
  );
}
