import { ConversationView } from '@/components/ConversationView'

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConversationView key={id} id={id} />
}
