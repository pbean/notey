import { useEffect } from 'react';
import { CaptureWindow } from './features/editor/components/CaptureWindow';
import { useWorkspaceStore } from './features/workspace/store';

/** Application root — renders the main CaptureWindow. */
function App() {
  useEffect(() => {
    useWorkspaceStore.getState().initWorkspace();
  }, []);

  return <CaptureWindow />;
}

export default App;
