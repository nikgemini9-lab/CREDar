import type { AccountRecord } from "../types";

interface Props {
  accounts: AccountRecord[];
}

export function AccountLeaderboard({ accounts }: Props) {
  return (
    <div className="panel">
      <h3 className="panel-title">Tracked accounts</h3>
      {accounts.length === 0 ? (
        <div className="empty-state">No accounts tracked yet.</div>
      ) : (
        <table className="account-table">
          <thead>
            <tr>
              <th></th>
              <th>Account</th>
              <th>Followers</th>
              <th style={{ textAlign: "right" }}>Mentions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account, i) => (
              <tr key={account.username}>
                <td className="account-rank">{i + 1}</td>
                <td className="account-name">
                  <a href={`https://x.com/${account.username}`} target="_blank" rel="noreferrer">
                    @{account.username}
                  </a>
                  {account.verified ? " ✓" : ""}
                </td>
                <td>{account.followers.toLocaleString()}</td>
                <td className="account-count">{account.mentionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
