import { useState } from 'react';

/**
 * 채널마다 '마지막으로 시작한 요청'만 화면에 반영하게 하는 표.
 * begin(channel) 은 새 세대를 열고, 그 요청이 아직 마지막인지 알려 주는 함수를 돌려준다.
 * join(channel) 은 세대를 올리지 않고 지금 세대에 묶인다(목록 '더 보기'처럼 이어 받는 요청).
 */
export interface LatestRequests<Channel extends string> {
  begin(channel: Channel): () => boolean;
  join(channel: Channel): () => boolean;
}

export function createLatestRequests<Channel extends string>(): LatestRequests<Channel> {
  const generations = new Map<Channel, number>();
  const current = (channel: Channel) => generations.get(channel) ?? 0;
  return {
    begin(channel) {
      const generation = current(channel) + 1;
      generations.set(channel, generation);
      return () => current(channel) === generation;
    },
    join(channel) {
      const generation = current(channel);
      return () => current(channel) === generation;
    },
  };
}

export function useLatestRequests<Channel extends string>(): LatestRequests<Channel> {
  const [requests] = useState(createLatestRequests<Channel>);
  return requests;
}
