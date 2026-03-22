package bridge

import (
	"encoding/binary"
	"encoding/json"
	"io"
	"sync"
)

type NativeWriter struct {
	target io.Writer
	mu     sync.Mutex
}

func NewNativeWriter(target io.Writer) *NativeWriter {
	return &NativeWriter{target: target}
}

func (w *NativeWriter) Send(message NativeMessage) error {
	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}

	header := make([]byte, 4)
	binary.LittleEndian.PutUint32(header, uint32(len(payload)))

	w.mu.Lock()
	defer w.mu.Unlock()

	if _, err := w.target.Write(header); err != nil {
		return err
	}
	_, err = w.target.Write(payload)
	return err
}

func ReadNativeMessage(source io.Reader) (NativeMessage, error) {
	header := make([]byte, 4)
	if _, err := io.ReadFull(source, header); err != nil {
		return NativeMessage{}, err
	}

	length := binary.LittleEndian.Uint32(header)
	payload := make([]byte, int(length))
	if _, err := io.ReadFull(source, payload); err != nil {
		return NativeMessage{}, err
	}

	var message NativeMessage
	if err := json.Unmarshal(payload, &message); err != nil {
		return NativeMessage{}, err
	}
	return message, nil
}
