import { useParams } from 'react-router-dom';

export default function Job() {
  const { id } = useParams();
  return <div><h1>Job {id}</h1><p>Live dashboard — coming soon.</p></div>;
}
