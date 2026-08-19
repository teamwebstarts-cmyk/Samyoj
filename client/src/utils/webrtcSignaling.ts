/** Skip duplicate Meta answers once the PC is already negotiated. */
export function canApplyRemoteAnswer(signalingState: string, alreadyConnected: boolean): boolean {
  if (alreadyConnected || signalingState === 'stable' || signalingState === 'closed') return false;
  return signalingState === 'have-local-offer' || signalingState === 'have-remote-pranswer';
}
